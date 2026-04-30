import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate);

const createAssignmentSchema = z.object({
  documentId: z.string().uuid(),
  assignedTo: z.string().uuid(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateAssignmentSchema = z.object({
  status: z.enum(['pendiente', 'visto', 'editado', 'revisado', 'completado', 'rechazado']).optional(),
  notes: z.string().optional(),
});

const assignmentsQuerySchema = paginationQuery.extend({
  status: z.enum(['pendiente', 'visto', 'editado', 'revisado', 'completado', 'rechazado']).optional(),
  /** Si true: asignaciones recibidas aún no marcadas como completadas (incl. visto, editado, revisado, rechazado). */
  pendingWork: z.coerce.boolean().optional(),
});

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  visto: 'Visto',
  editado: 'Editado',
  revisado: 'Revisado',
  completado: 'Completado',
  rechazado: 'Rechazado',
};

// ─── GET /api/assignments (mis asignaciones recibidas) ──────────────────────
assignmentsRouter.get(
  '/',
  validateQuery(assignmentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, status, pendingWork } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = { assignedTo: req.user!.id };
      if (pendingWork) {
        where.status = { not: 'completado' };
      } else if (status) {
        where.status = status;
      }

      const [assignments, total] = await Promise.all([
        prisma.documentAssignment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            document: {
              select: { id: true, name: true, type: true, fileStatus: true, updatedAt: true },
            },
            assigner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        }),
        prisma.documentAssignment.count({ where }),
      ]);

      res.json({ data: assignments, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/assignments/sent (asignaciones que yo envié) ──────────────
assignmentsRouter.get(
  '/sent',
  validateQuery(assignmentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, status } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = { assignedBy: req.user!.id };
      if (status) where.status = status;

      const [assignments, total] = await Promise.all([
        prisma.documentAssignment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            document: { select: { id: true, name: true, type: true, fileStatus: true, updatedAt: true } },
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            assigner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        }),
        prisma.documentAssignment.count({ where: { assignedBy: req.user!.id } }),
      ]);

      res.json({ data: assignments, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/assignments ──────────────────────────────────────────────────
assignmentsRouter.post(
  '/',
  validate(createAssignmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
      const now = new Date();

      const existing = await prisma.documentAssignment.findUnique({
        where: {
          documentId_assignedTo: {
            documentId: data.documentId,
            assignedTo: data.assignedTo,
          },
        },
      });

      if (existing) {
        const isOverdue = !!existing.dueDate && existing.dueDate.getTime() < now.getTime();
        const canReassignExisting = existing.status === 'rechazado' || isOverdue;

        if (!canReassignExisting) {
          return res.status(409).json({ error: 'El registro ya existe' });
        }

        const reassigned = await prisma.documentAssignment.update({
          where: { id: existing.id },
          data: {
            assignedBy: req.user!.id,
            status: 'pendiente',
            notes: data.notes,
            dueDate,
            completedAt: null,
          },
          include: {
            document: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });

        await prisma.notification.create({
          data: {
            userId: data.assignedTo,
            title: 'Documento reasignado',
            message: `${req.user!.name} te reasignó el documento: ${reassigned.document.name}`,
            type: 'assignment',
            entityType: 'document',
            entityId: data.documentId,
          },
        });

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'DOCUMENT_ASSIGNED',
            entityType: 'document',
            entityId: data.documentId,
            entityName: reassigned.document.name,
            description: `Documento reasignado a ${reassigned.assignee.name}`,
            metadata: {
              assignmentId: reassigned.id,
              reassigned: true,
              previousStatus: existing.status,
            },
          },
        });

        return res.status(200).json(reassigned);
      }

      const assignment = await prisma.documentAssignment.create({
        data: {
          documentId: data.documentId,
          assignedTo: data.assignedTo,
          assignedBy: req.user!.id,
          notes: data.notes,
          dueDate,
        },
        include: {
          document: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      // Actualizar sharing_status del documento
      await prisma.document.update({
        where: { id: data.documentId },
        data: { sharingStatus: 'ASIGNADO' },
      });

      // Notificar al asignado
      await prisma.notification.create({
        data: {
          userId: data.assignedTo,
          title: 'Nuevo documento asignado',
          message: `${req.user!.name} te asignó el documento: ${assignment.document.name}`,
          type: 'assignment',
          entityType: 'document',
          entityId: data.documentId,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_ASSIGNED',
          entityType: 'document',
          entityId: data.documentId,
          entityName: assignment.document.name,
          description: `Documento asignado a ${assignment.assignee.name}`,
        },
      });

      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/assignments/:id ─────────────────────────────────────────────
assignmentsRouter.patch(
  '/:id',
  validateParams(uuidParam),
  validate(updateAssignmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.documentAssignment.findUnique({
        where: { id: req.params.id as string },
        include: { document: { select: { id: true, name: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }

      if (existing.assignedTo !== req.user!.id && existing.assignedBy !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos para modificar esta asignación' });
      }

      const data = req.body;

      // ── Validar transición de estado ──
      if (data.status) {
        const validTransitions: Record<string, string[]> = {
          pendiente: ['visto', 'editado', 'rechazado'],
          visto: ['editado', 'completado', 'rechazado'],
          editado: ['completado', 'rechazado'],
          completado: [],   // estado terminal
          rechazado: [],    // estado terminal
        };
        const allowed = validTransitions[existing.status] ?? [];
        if (!allowed.includes(data.status)) {
          return res.status(400).json({
            error: `No se puede cambiar de "${existing.status}" a "${data.status}"`,
          });
        }
      }

      const updateData: any = { ...data };

      if (data.status === 'completado' || data.status === 'rechazado') {
        updateData.completedAt = new Date();
      }

      const assignment = await prisma.documentAssignment.update({
        where: { id: req.params.id as string },
        data: updateData,
        include: {
          document: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      });

      // ── Notificar al asignador en estados terminales ──
      if (data.status === 'completado' || data.status === 'rechazado') {
        const statusLabel = data.status === 'completado' ? 'completada' : 'rechazada';
        prisma.notification.create({
          data: {
            userId: existing.assignedBy,
            title: `Asignación ${statusLabel}`,
            message: `${(assignment as any).assignee?.name ?? 'Un usuario'} marcó el documento "${(assignment as any).document?.name ?? 'Documento'}" como ${data.status}`,
            type: 'assignment',
            entityType: 'document',
            entityId: existing.documentId,
          },
        }).catch(err => console.error('[Assignment notification] Error:', err));
      }

      if (data.status && data.status !== existing.status) {
        const isTerminal = data.status === 'completado' || data.status === 'rechazado';
        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: isTerminal ? 'COLLABORATION_ENDED' : 'COLLABORATION_STARTED',
            entityType: 'document',
            entityId: existing.documentId,
            entityName: existing.document.name,
            description: `Estado de asignación: ${ASSIGNMENT_STATUS_LABEL[existing.status] ?? existing.status} → ${ASSIGNMENT_STATUS_LABEL[data.status] ?? data.status}`,
            metadata: {
              assignmentId: assignment.id,
              fromStatus: existing.status,
              toStatus: data.status,
              automatic: false,
            },
          },
        });
      }

      res.json(assignment);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Asignación no encontrada o ya fue eliminada' });
      }
      next(error);
    }
  },
);

// ─── DELETE /api/assignments/:id ────────────────────────────────────────────
assignmentsRouter.delete(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignmentId = req.params.id as string;

      const assignment = await prisma.documentAssignment.findUnique({
        where: { id: assignmentId }
      });

      if (!assignment) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }

      if (assignment.assignedBy !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos para eliminar esta asignación' });
      }

      await prisma.documentAssignment.delete({
        where: { id: assignmentId as string }
      });

      res.json({ message: 'Asignación eliminada correctamente' });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Asignación no encontrada o ya fue eliminada' });
      }
      next(error);
    }
  }
);

