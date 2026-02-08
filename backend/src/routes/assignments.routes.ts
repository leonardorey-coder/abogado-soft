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
  status: z.enum(['pendiente', 'visto', 'revisado', 'completado', 'rechazado']).optional(),
  notes: z.string().optional(),
});

// ─── GET /api/assignments (mis asignaciones recibidas) ──────────────────────
assignmentsRouter.get(
  '/',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder } = req.query as any;
      const skip = (page - 1) * limit;

      const [assignments, total] = await Promise.all([
        prisma.documentAssignment.findMany({
          where: { assignedTo: req.user!.id },
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
        prisma.documentAssignment.count({ where: { assignedTo: req.user!.id } }),
      ]);

      res.json({ data: assignments, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/assignments/sent (asignaciones que yo envié) ──────────────────
assignmentsRouter.get(
  '/sent',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder } = req.query as any;
      const skip = (page - 1) * limit;

      const [assignments, total] = await Promise.all([
        prisma.documentAssignment.findMany({
          where: { assignedBy: req.user!.id },
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            document: { select: { id: true, name: true, type: true } },
            assignee: { select: { id: true, name: true, email: true } },
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

      const assignment = await prisma.documentAssignment.create({
        data: {
          documentId: data.documentId,
          assignedTo: data.assignedTo,
          assignedBy: req.user!.id,
          notes: data.notes,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
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
      const data = req.body;
      const updateData: any = { ...data };

      if (data.status === 'completado') {
        updateData.completedAt = new Date();
      }

      const assignment = await prisma.documentAssignment.update({
        where: { id: req.params.id },
        data: updateData,
      });

      res.json(assignment);
    } catch (error) {
      next(error);
    }
  },
);
