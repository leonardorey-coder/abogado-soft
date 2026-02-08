// ============================================================================
// Collaboration Routes — Edición colaborativa Google Docs-like
// Usa Supabase Realtime para broadcast de operaciones, presencia y locks.
// Persistencia en PostgreSQL vía Prisma.
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import {
  broadcastToDocument,
  closeDocumentChannel,
  type RealtimeOperation,
  type RealtimePresence,
  type RealtimeLock,
  type RealtimeComment,
} from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, uuidParam } from '../middleware/validate.js';

export const collaborationRouter = Router();
collaborationRouter.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// SESIONES DE COLABORACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const startSessionSchema = z.object({
  documentId: z.string().uuid(),
});

// ─── POST /api/collaboration/sessions ───────────────────────────────────────
// Crear o unirse a una sesión de edición colaborativa.
// Abre el canal Realtime del documento y emite presencia.
collaborationRouter.post(
  '/sessions',
  validate(startSessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId } = req.body;

      // Buscar o crear sesión activa
      let session = await prisma.collaborationSession.findFirst({
        where: { documentId, isActive: true },
      });

      const isNewSession = !session;

      if (!session) {
        session = await prisma.collaborationSession.create({
          data: { documentId },
        });

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'COLLABORATION_STARTED',
            entityType: 'document',
            entityId: documentId,
          },
        });
      }

      // Registrar presencia en BD
      await prisma.collaborationPresence.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId: req.user!.id,
          },
        },
        update: {
          isActive: true,
          lastSeen: new Date(),
          leftAt: null,
        },
        create: {
          sessionId: session.id,
          userId: req.user!.id,
        },
      });

      // Broadcast presencia vía Supabase Realtime
      const presenceEvent: RealtimePresence = {
        type: 'presence',
        userId: req.user!.id,
        userName: req.user!.name,
        action: 'join',
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(documentId, presenceEvent);

      // Devolver sesión con usuarios activos
      const sessionWithPresence = await prisma.collaborationSession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          presence: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      });

      res.status(201).json({
        ...sessionWithPresence,
        isNewSession,
        realtimeChannel: `document:${documentId}`,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCIA (cursor position / heartbeat)
// ─────────────────────────────────────────────────────────────────────────────

const updatePresenceSchema = z.object({
  cursorPosition: z.object({
    line: z.number(),
    column: z.number(),
    selectionStart: z.number().optional(),
    selectionEnd: z.number().optional(),
  }).optional(),
});

// ─── PATCH /api/collaboration/sessions/:id/presence ─────────────────────────
// Actualizar posición del cursor. Broadcast instantáneo vía Realtime.
collaborationRouter.patch(
  '/sessions/:id/presence',
  validateParams(uuidParam),
  validate(updatePresenceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obtener documentId de la sesión
      const session = await prisma.collaborationSession.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { documentId: true },
      });

      // Actualizar en BD (fire-and-forget, no bloquea respuesta)
      prisma.collaborationPresence.updateMany({
        where: {
          sessionId: req.params.id,
          userId: req.user!.id,
        },
        data: {
          cursorPosition: req.body.cursorPosition ?? undefined,
          lastSeen: new Date(),
        },
      }).catch(console.error);

      // Broadcast instantáneo vía Supabase Realtime
      const presenceEvent: RealtimePresence = {
        type: 'presence',
        userId: req.user!.id,
        userName: req.user!.name,
        cursorPosition: req.body.cursorPosition,
        action: 'move',
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(session.documentId, presenceEvent);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ABANDONAR SESIÓN
// ─────────────────────────────────────────────────────────────────────────────

// ─── POST /api/collaboration/sessions/:id/leave ────────────────────────────
collaborationRouter.post(
  '/sessions/:id/leave',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.collaborationSession.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { id: true, documentId: true },
      });

      // Marcar presencia como inactiva
      await prisma.collaborationPresence.updateMany({
        where: {
          sessionId: session.id,
          userId: req.user!.id,
        },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });

      // Liberar locks del usuario en este documento
      await prisma.documentLock.updateMany({
        where: {
          documentId: session.documentId,
          userId: req.user!.id,
          releasedAt: null,
        },
        data: { releasedAt: new Date() },
      });

      // Broadcast desconexión
      const presenceEvent: RealtimePresence = {
        type: 'presence',
        userId: req.user!.id,
        userName: req.user!.name,
        action: 'leave',
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(session.documentId, presenceEvent);

      // Si no quedan usuarios activos, cerrar sesión + canal Realtime
      const activeCount = await prisma.collaborationPresence.count({
        where: { sessionId: session.id, isActive: true },
      });

      if (activeCount === 0) {
        await prisma.collaborationSession.update({
          where: { id: session.id },
          data: { isActive: false, endedAt: new Date() },
        });

        await closeDocumentChannel(session.documentId);

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'COLLABORATION_ENDED',
            entityType: 'document',
            entityId: session.documentId,
          },
        });
      }

      res.json({ message: 'Sesión abandonada', activeUsers: activeCount });
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES DE EDICIÓN (OT — Operational Transform)
// ─────────────────────────────────────────────────────────────────────────────

const operationSchema = z.object({
  operationType: z.enum(['insert', 'delete', 'replace', 'format', 'cursor_move']),
  position: z.number().int().optional(),
  length: z.number().int().optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  revision: z.number().int(),
});

// ─── POST /api/collaboration/sessions/:id/operations ────────────────────────
// Recibe una operación de edición, la persiste y la broadcast instantáneamente.
collaborationRouter.post(
  '/sessions/:id/operations',
  validateParams(uuidParam),
  validate(operationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.collaborationSession.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { id: true, documentId: true },
      });

      // Persistir operación (log OT)
      const op = await prisma.collaborationOperation.create({
        data: {
          sessionId: session.id,
          userId: req.user!.id,
          operationType: req.body.operationType,
          position: req.body.position,
          length: req.body.length,
          content: req.body.content,
          metadata: req.body.metadata,
          revision: BigInt(req.body.revision),
        },
      });

      // Broadcast instantáneo vía Supabase Realtime
      const opEvent: RealtimeOperation = {
        type: 'operation',
        sessionId: session.id,
        userId: req.user!.id,
        userName: req.user!.name,
        operationType: req.body.operationType,
        position: req.body.position,
        length: req.body.length,
        content: req.body.content,
        metadata: req.body.metadata,
        revision: req.body.revision,
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(session.documentId, opEvent);

      res.status(201).json({
        id: op.id,
        revision: Number(op.revision),
        timestamp: op.createdAt,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/collaboration/sessions/:id/operations ─────────────────────────
// Catch-up: obtener operaciones desde una revisión específica (para reconexión).
collaborationRouter.get(
  '/sessions/:id/operations',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sinceRevision = parseInt(req.query.since as string) || 0;

      const operations = await prisma.collaborationOperation.findMany({
        where: {
          sessionId: req.params.id,
          revision: { gt: BigInt(sinceRevision) },
        },
        orderBy: { revision: 'asc' },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      // Convertir BigInt → Number para JSON
      const serialized = operations.map((op) => ({
        ...op,
        revision: Number(op.revision),
      }));

      res.json(serialized);
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUEO DE SECCIONES (locks)
// ─────────────────────────────────────────────────────────────────────────────

const lockSchema = z.object({
  documentId: z.string().uuid(),
  sectionId: z.string().max(255).optional(),
  lockType: z.enum(['document', 'section', 'paragraph']).default('section'),
});

// ─── POST /api/collaboration/locks ──────────────────────────────────────────
collaborationRouter.post(
  '/locks',
  validate(lockSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lock = await prisma.documentLock.create({
        data: {
          documentId: req.body.documentId,
          userId: req.user!.id,
          sectionId: req.body.sectionId,
          lockType: req.body.lockType,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      // Broadcast lock adquirido
      const lockEvent: RealtimeLock = {
        type: 'lock',
        lockId: lock.id,
        userId: req.user!.id,
        userName: req.user!.name,
        sectionId: req.body.sectionId,
        lockType: req.body.lockType,
        action: 'acquired',
        expiresAt: lock.expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(req.body.documentId, lockEvent);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_LOCKED',
          entityType: 'document',
          entityId: req.body.documentId,
          metadata: { sectionId: req.body.sectionId, lockType: req.body.lockType },
        },
      });

      res.status(201).json(lock);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/collaboration/locks/:id ────────────────────────────────────
collaborationRouter.delete(
  '/locks/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lock = await prisma.documentLock.update({
        where: { id: req.params.id },
        data: { releasedAt: new Date() },
      });

      // Broadcast lock liberado
      const lockEvent: RealtimeLock = {
        type: 'lock',
        lockId: lock.id,
        userId: req.user!.id,
        userName: req.user!.name,
        sectionId: lock.sectionId ?? undefined,
        lockType: lock.lockType as 'document' | 'section' | 'paragraph',
        action: 'released',
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(lock.documentId, lockEvent);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_UNLOCKED',
          entityType: 'document',
          entityId: lock.documentId,
        },
      });

      res.json({ message: 'Lock liberado' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/collaboration/locks/document/:id ──────────────────────────────
collaborationRouter.get(
  '/locks/document/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locks = await prisma.documentLock.findMany({
        where: {
          documentId: req.params.id,
          releasedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      res.json(locks);
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// COMENTARIOS EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────────────────────

const realtimeCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
  pageNumber: z.number().int().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

// ─── POST /api/collaboration/documents/:id/comments ─────────────────────────
// Agregar comentario con broadcast Realtime a editores activos.
collaborationRouter.post(
  '/documents/:id/comments',
  validateParams(uuidParam),
  validate(realtimeCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.documentComment.create({
        data: {
          documentId: req.params.id,
          userId: req.user!.id,
          ...req.body,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Broadcast comentario
      const commentEvent: RealtimeComment = {
        type: 'comment',
        commentId: comment.id,
        userId: req.user!.id,
        userName: req.user!.name,
        content: req.body.content,
        parentId: req.body.parentId,
        action: 'added',
        timestamp: new Date().toISOString(),
      };
      await broadcastToDocument(req.params.id, commentEvent);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_COMMENT_ADDED',
          entityType: 'document',
          entityId: req.params.id,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/collaboration/documents/:id/active-users ──────────────────────
// Usuarios editando actualmente un documento.
collaborationRouter.get(
  '/documents/:id/active-users',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await prisma.collaborationSession.findFirst({
        where: { documentId: req.params.id, isActive: true },
        include: {
          presence: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      });

      res.json({
        activeUsers: session?.presence ?? [],
        realtimeChannel: `document:${req.params.id}`,
      });
    } catch (error) {
      next(error);
    }
  },
);
