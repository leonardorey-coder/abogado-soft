// ============================================================================
// calendar-notes.routes.ts — CRUD de notas rápidas del calendario
// GET /api/calendar-notes?from=YYYY-MM-DD&to=YYYY-MM-DD
// PUT /api/calendar-notes/:dateKey   (upsert — una nota por día por usuario)
// DELETE /api/calendar-notes/:dateKey
// ============================================================================

import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const calendarNotesRouter = Router();

function formatDateKeyLabel(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Todos los endpoints requieren autenticación
calendarNotesRouter.use(authenticate);

// ── GET /api/calendar-notes?from=YYYY-MM-DD&to=YYYY-MM-DD ─────────────────
// Devuelve las notas del usuario autenticado en el rango de fechas dado.
calendarNotesRouter.get('/', async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string; firmId?: string | null };
    const { from, to } = req.query as { from?: string; to?: string };

    // Si el usuario tiene despacho, mostrar notas de todo el despacho (compartidas).
    // Si no, mostrar solo las propias.
    const where: any = user.firmId
      ? {
          user: { firmId: user.firmId },
        }
      : { userId: user.id };

    if (from || to) {
      where.dateKey = {};
      if (from) where.dateKey.gte = new Date(from);
      if (to)   where.dateKey.lte = new Date(to);
    }

    const notes = await prisma.calendarNote.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { dateKey: 'asc' },
    });

    res.json(notes);
  } catch (err) {
    next(err);
  }
});


// ── PUT /api/calendar-notes/:dateKey ──────────────────────────────────────
// Upsert: crea o actualiza la nota del usuario para ese día.
// Body: { content: string }
calendarNotesRouter.put('/:dateKey', async (req, res, next) => {
  try {
    const userId = (req as any).user?.id as string;
    const { dateKey } = req.params;
    const { content } = req.body as { content: string };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'El contenido de la nota es requerido.' });
    }

    const date = new Date(dateKey);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    const trimmedContent = content.trim();
    const existingNote = await prisma.calendarNote.findUnique({
      where: { dateKey_userId: { dateKey: date, userId } },
    });

    const note = await prisma.calendarNote.upsert({
      where: { dateKey_userId: { dateKey: date, userId } },
      create: { dateKey: date, userId, content: trimmedContent },
      update: { content: trimmedContent },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!existingNote) {
      await prisma.activityLog.create({
        data: {
          firmId: (req as any).user?.firmId ?? null,
          userId,
          activity: 'CALENDAR_NOTE_CREATED',
          entityType: 'calendar_note',
          entityId: note.id,
          entityName: `Nota rápida (${formatDateKeyLabel(date)})`,
          description: `Creó una nota rápida para ${formatDateKeyLabel(date)}`,
          metadata: {
            dateKey: note.dateKey.toISOString().slice(0, 10),
            noteContent: note.content,
          },
        },
      });
    } else if (existingNote.content !== trimmedContent) {
      await prisma.activityLog.create({
        data: {
          firmId: (req as any).user?.firmId ?? null,
          userId,
          activity: 'CALENDAR_NOTE_UPDATED',
          entityType: 'calendar_note',
          entityId: note.id,
          entityName: `Nota rápida (${formatDateKeyLabel(date)})`,
          description: `Actualizó una nota rápida de ${formatDateKeyLabel(date)}`,
          metadata: {
            dateKey: note.dateKey.toISOString().slice(0, 10),
            noteContent: note.content,
          },
        },
      });
    }

    res.json(note);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/calendar-notes/:dateKey ───────────────────────────────────
// Elimina la nota del usuario para ese día.
calendarNotesRouter.delete('/:dateKey', async (req, res, next) => {
  try {
    const userId = (req as any).user?.id as string;
    const { dateKey } = req.params;

    const date = new Date(dateKey);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido.' });
    }

    const existingNote = await prisma.calendarNote.findUnique({
      where: { dateKey_userId: { dateKey: date, userId } },
    });

    // Solo el autor puede eliminar su nota
    if (!existingNote) {
      return res.status(404).json({ error: 'Nota no encontrada.' });
    }

    await prisma.calendarNote.delete({
      where: { dateKey_userId: { dateKey: date, userId } },
    });

    await prisma.activityLog.create({
      data: {
        firmId: (req as any).user?.firmId ?? null,
        userId,
        activity: 'CALENDAR_NOTE_DELETED',
        entityType: 'calendar_note',
        entityId: existingNote.id,
        entityName: `Nota rápida (${formatDateKeyLabel(date)})`,
        description: `Eliminó una nota rápida de ${formatDateKeyLabel(date)}`,
        metadata: {
          dateKey: existingNote.dateKey.toISOString().slice(0, 10),
          noteContent: existingNote.content,
        },
      },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
