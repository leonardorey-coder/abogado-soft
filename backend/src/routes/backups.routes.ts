import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const backupsRouter = Router();
backupsRouter.use(authenticate);
backupsRouter.use(authorize('admin'));

const createBackupSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.enum(['full', 'incremental', 'documents_only', 'database_only']).default('full'),
});

// ─── GET /api/backups ───────────────────────────────────────────────────────
backupsRouter.get(
  '/',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;

      const [backups, total] = await Promise.all([
        prisma.backup.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            creator: { select: { id: true, name: true } },
          },
        }),
        prisma.backup.count(),
      ]);

      res.json({ data: backups, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/backups ──────────────────────────────────────────────────────
backupsRouter.post(
  '/',
  validate(createBackupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docCount = await prisma.document.count({ where: { isDeleted: false } });

      const backup = await prisma.backup.create({
        data: {
          ...req.body,
          createdBy: req.user!.id,
          status: 'pending',
          documentsCount: docCount,
          startedAt: new Date(),
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'BACKUP_CREATED',
          entityType: 'backup',
          entityId: backup.id,
          entityName: backup.name,
          description: `Respaldo creado: ${backup.name} (${backup.type})`,
        },
      });

      // TODO: Aquí se dispararía el proceso de respaldo real (job queue)

      res.status(201).json(backup);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/backups/:id ───────────────────────────────────────────────────
backupsRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { creator: { select: { id: true, name: true } } },
      });
      res.json(backup);
    } catch (error) {
      next(error);
    }
  },
);
