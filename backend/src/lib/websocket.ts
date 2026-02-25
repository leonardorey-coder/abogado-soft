// ============================================================================
// WebSocket Server — Edición colaborativa en tiempo real con Y.js + Socket.io
// Gestiona Y.Docs en memoria, sincroniza entre clientes, persiste en DB.
// ============================================================================

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import prisma from './prisma.js';

// ─── In-memory Y.js document store ──────────────────────────────────────────

interface DocEntry {
  ydoc: Y.Doc;
  connections: number;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

const docs = new Map<string, DocEntry>();

function getOrCreateYDoc(docId: string): DocEntry {
  let entry = docs.get(docId);
  if (!entry) {
    const ydoc = new Y.Doc();
    entry = { ydoc, connections: 0, saveTimer: null };
    docs.set(docId, entry);
  }
  return entry;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

async function loadYDocFromDB(docId: string, ydoc: Y.Doc): Promise<void> {
  try {
    // ydocState fue eliminado del schema — el estado Y.js se mantiene en memoria.
    // La persistencia de documentos se realiza vía Google Drive.
    console.log(`[WS] Y.Doc ${docId} inicializado (sin estado persistido en DB)`);
  } catch (error) {
    console.error(`[WS] Error loading doc ${docId}:`, error);
  }
}

async function saveYDocToDB(docId: string, _ydoc: Y.Doc): Promise<void> {
  try {
    // ydocState fue eliminado del schema — sincronización vía Google Drive.
    console.log(`[WS] Y.Doc ${docId} — persistencia en Drive (no en DB)`);
  } catch (error) {
    console.error(`[WS] Error saving doc ${docId}:`, error);
  }
}

function debouncedSave(docId: string, entry: DocEntry) {
  if (entry.saveTimer) clearTimeout(entry.saveTimer);
  entry.saveTimer = setTimeout(() => {
    saveYDocToDB(docId, entry.ydoc);
  }, 5000); // Save 5s after last change
}

// ─── Setup WebSocket server ──────────────────────────────────────────────────

export function setupWebSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    },
    path: '/ws',
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    let currentDocId: string | null = null;
    console.log(`[WS] Client connected: ${socket.id}`);

    // ─── Join a document room ──────────────────────────────────────────
    socket.on('join-document', async (data: {
      documentId: string;
      user: { id: string; name: string; color: string };
    }) => {
      const { documentId, user } = data;
      currentDocId = documentId;
      socket.data.user = user;
      socket.data.documentId = documentId;
      socket.join(documentId);

      const entry = getOrCreateYDoc(documentId);
      const isFirstClient = entry.connections === 0;
      entry.connections++;

      // Load from database if first client joining the room
      if (isFirstClient) {
        await loadYDocFromDB(documentId, entry.ydoc);
      }

      // Send current Y.js state to the new client
      const state = Y.encodeStateAsUpdate(entry.ydoc);
      socket.emit('sync-state', {
        state: Array.from(state),
      });

      // Broadcast presence to the room
      emitPresence(io, documentId);

      console.log(`[WS] ${user.name} joined doc ${documentId} (${entry.connections} users)`);
    });

    // ─── Receive Y.js update from client ───────────────────────────────
    socket.on('sync-update', (data: { update: number[] }) => {
      if (!currentDocId) return;
      const entry = docs.get(currentDocId);
      if (!entry) return;

      try {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(entry.ydoc, update);

        // Broadcast to all other clients in the room
        socket.to(currentDocId).emit('sync-update', { update: data.update });

        // Debounced save to database
        debouncedSave(currentDocId, entry);
      } catch (error) {
        console.error('[WS] Error applying update:', error);
      }
    });

    // ─── Awareness / cursor updates ────────────────────────────────────
    socket.on('awareness-update', (data: { cursor: any }) => {
      if (!currentDocId) return;
      socket.to(currentDocId).emit('awareness-update', {
        clientId: socket.id,
        user: socket.data.user,
        cursor: data.cursor,
      });
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
      if (!currentDocId) return;

      const entry = docs.get(currentDocId);
      if (!entry) return;

      entry.connections--;

      // Broadcast updated presence
      emitPresence(io, currentDocId);

      // If no more clients connected, save and cleanup
      if (entry.connections <= 0) {
        if (entry.saveTimer) clearTimeout(entry.saveTimer);
        await saveYDocToDB(currentDocId, entry.ydoc);
        entry.ydoc.destroy();
        docs.delete(currentDocId);
        console.log(`[WS] Room ${currentDocId} cleaned up`);
      }
    });
  });

  // ─── Periodic auto-save every 30 seconds ─────────────────────────────
  setInterval(async () => {
    for (const [docId, entry] of docs) {
      if (entry.connections > 0) {
        await saveYDocToDB(docId, entry.ydoc);
      }
    }
  }, 30_000);

  console.log('🔌 WebSocket server (Socket.io + Y.js) ready');
  return io;
}

// ─── Helper: emit presence to room ───────────────────────────────────────────

function emitPresence(io: SocketIOServer, documentId: string) {
  const room = io.sockets.adapter.rooms.get(documentId);
  const users = Array.from(room ?? [])
    .map((id) => io.sockets.sockets.get(id)?.data.user)
    .filter(Boolean);
  io.to(documentId).emit('presence-update', { users });
}
