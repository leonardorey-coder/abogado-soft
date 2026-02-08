// ============================================================================
// Supabase Client — SOLO para Realtime channels + Auth JWT verification
// Toda la lectura/escritura de datos va por Prisma, NO por supabase-client.
// ============================================================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY no configurado — Realtime no funcionará');
}

/**
 * Cliente Supabase con service_role key para operaciones del servidor:
 * - Broadcast Realtime (operaciones, presencia, locks)
 * - Verificación de JWT (alternativa a jsonwebtoken)
 *
 * NO se usa para queries a la BD — eso es responsabilidad de Prisma.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 40,  // suficiente para edición colaborativa fluida
    },
  },
});

// ─── Cache de canales Realtime por documento ─────────────────────────────────
const documentChannels = new Map<string, RealtimeChannel>();

/**
 * Obtiene (o crea) el canal Realtime de un documento.
 * Cada documento tiene un canal único: `document:{documentId}`
 *
 * Los clientes frontend se suscriben a este canal para recibir:
 * - `operation`  → operaciones de edición (OT)
 * - `presence`   → posición del cursor / heartbeat
 * - `lock`       → bloqueo/desbloqueo de secciones
 * - `comment`    → nuevos comentarios en tiempo real
 */
export function getDocumentChannel(documentId: string): RealtimeChannel {
  const existing = documentChannels.get(documentId);
  if (existing) return existing;

  const channel = supabase.channel(`document:${documentId}`, {
    config: {
      broadcast: { self: false },  // el emisor no recibe su propio broadcast
      presence: { key: '' },       // se usa el userId como key
    },
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`📡 Canal Realtime activo: document:${documentId}`);
    }
  });

  documentChannels.set(documentId, channel);
  return channel;
}

/**
 * Cierra el canal Realtime de un documento cuando ya no hay editores activos.
 */
export async function closeDocumentChannel(documentId: string): Promise<void> {
  const channel = documentChannels.get(documentId);
  if (channel) {
    await supabase.removeChannel(channel);
    documentChannels.delete(documentId);
    console.log(`📡 Canal Realtime cerrado: document:${documentId}`);
  }
}

// ─── Tipos de eventos Realtime ──────────────────────────────────────────────

export interface RealtimeOperation {
  type: 'operation';
  sessionId: string;
  userId: string;
  userName: string;
  operationType: 'insert' | 'delete' | 'replace' | 'format' | 'cursor_move';
  position?: number;
  length?: number;
  content?: string;
  metadata?: Record<string, unknown>;
  revision: number;
  timestamp: string;
}

export interface RealtimePresence {
  type: 'presence';
  userId: string;
  userName: string;
  avatarUrl?: string;
  cursorPosition?: {
    line: number;
    column: number;
    selectionStart?: number;
    selectionEnd?: number;
  };
  action: 'join' | 'move' | 'leave';
  timestamp: string;
}

export interface RealtimeLock {
  type: 'lock';
  lockId: string;
  userId: string;
  userName: string;
  sectionId?: string;
  lockType: 'document' | 'section' | 'paragraph';
  action: 'acquired' | 'released';
  expiresAt?: string;
  timestamp: string;
}

export interface RealtimeComment {
  type: 'comment';
  commentId: string;
  userId: string;
  userName: string;
  content: string;
  parentId?: string;
  action: 'added' | 'resolved' | 'deleted';
  timestamp: string;
}

export type RealtimeEvent = RealtimeOperation | RealtimePresence | RealtimeLock | RealtimeComment;

/**
 * Emite un evento Realtime al canal del documento.
 * Todos los clientes suscritos al canal lo recibirán instantáneamente.
 */
export async function broadcastToDocument(
  documentId: string,
  event: RealtimeEvent,
): Promise<void> {
  const channel = getDocumentChannel(documentId);

  await channel.send({
    type: 'broadcast',
    event: event.type,
    payload: event,
  });
}

export default supabase;
