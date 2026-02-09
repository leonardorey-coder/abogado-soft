// ============================================================================
// SocketIOProvider — Provider de Y.js sobre Socket.io para edición colaborativa
// Sincroniza Y.Doc entre clientes a través del servidor WebSocket.
// ============================================================================

import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const WS_URL = API_BASE.replace('/api', '');

export interface ConnectedUser {
  id: string;
  name: string;
  color: string;
}

export class SocketIOProvider {
  doc: Y.Doc;
  socket: Socket;
  documentId: string;
  user: ConnectedUser;
  private _synced = false;
  private _destroyed = false;

  onUsersChange?: (users: ConnectedUser[]) => void;
  onSynced?: () => void;
  onAwareness?: (data: { clientId: string; user: ConnectedUser; cursor: any }) => void;

  constructor(documentId: string, doc: Y.Doc, user: ConnectedUser) {
    this.documentId = documentId;
    this.doc = doc;
    this.user = user;

    this.socket = io(WS_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this._setupSocketListeners();
    this._setupDocListener();
  }

  // ─── Socket.io event handlers ──────────────────────────────────────────

  private _setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('[SocketIOProvider] Connected');
      this.socket.emit('join-document', {
        documentId: this.documentId,
        user: this.user,
      });
    });

    // Receive the full Y.js document state on join
    this.socket.on('sync-state', (data: { state: number[] }) => {
      if (this._destroyed) return;
      try {
        const update = new Uint8Array(data.state);
        Y.applyUpdate(this.doc, update, 'remote');
        this._synced = true;
        this.onSynced?.();
        console.log('[SocketIOProvider] Initial sync complete');
      } catch (error) {
        console.error('[SocketIOProvider] Error applying sync state:', error);
      }
    });

    // Receive incremental updates from other clients
    this.socket.on('sync-update', (data: { update: number[] }) => {
      if (this._destroyed) return;
      try {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(this.doc, update, 'remote');
      } catch (error) {
        console.error('[SocketIOProvider] Error applying update:', error);
      }
    });

    // Presence updates (list of connected users)
    this.socket.on('presence-update', (data: { users: ConnectedUser[] }) => {
      this.onUsersChange?.(data.users);
    });

    // Awareness / cursor updates from other clients
    this.socket.on('awareness-update', (data: { clientId: string; user: ConnectedUser; cursor: any }) => {
      this.onAwareness?.(data);
    });

    this.socket.on('disconnect', () => {
      console.log('[SocketIOProvider] Disconnected');
    });

    this.socket.on('reconnect', () => {
      console.log('[SocketIOProvider] Reconnected, re-joining document');
      this.socket.emit('join-document', {
        documentId: this.documentId,
        user: this.user,
      });
    });
  }

  // ─── Y.Doc change listener ────────────────────────────────────────────

  private _onDocUpdate = (update: Uint8Array, origin: any) => {
    // Only send updates that originated locally (from user typing)
    // Skip updates that came from the socket (remote)
    if (origin === 'remote' || this._destroyed) return;
    this.socket.emit('sync-update', {
      update: Array.from(update),
    });
  };

  private _setupDocListener() {
    this.doc.on('update', this._onDocUpdate);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  get synced(): boolean {
    return this._synced;
  }

  sendAwareness(cursor: any) {
    if (this._destroyed) return;
    this.socket.emit('awareness-update', { cursor });
  }

  destroy() {
    this._destroyed = true;
    this.doc.off('update', this._onDocUpdate);
    this.socket.emit('leave-document', { documentId: this.documentId });
    this.socket.disconnect();
  }
}
