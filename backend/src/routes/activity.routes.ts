import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateQuery, paginationQuery } from '../middleware/validate.js';

export const activityRouter = Router();
activityRouter.use(authenticate);

const activityQuerySchema = paginationQuery.extend({
  userId: z.string().uuid().optional(),
  activity: z.string().optional(),
  entityType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── GET /api/activity ──────────────────────────────────────────────────────
// Bitácora de actividad. Admin ve todo, asistente ve solo su actividad.
activityRouter.get(
  '/',
  validateQuery(activityQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, userId, activity, entityType, from, to } = req.query as any;
      const skip = (page - 1) * limit;
      const where: any = {};

      // Asistentes solo ven su propia actividad
      if (req.user!.role !== 'admin') {
        where.userId = req.user!.id;
      } else if (userId) {
        where.userId = userId;
      }

      if (activity) where.activity = activity;
      if (entityType) where.entityType = entityType;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({ data: logs, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/activity/stats ────────────────────────────────────────────────
// Estadísticas de actividad para el dashboard.
activityRouter.get(
  '/stats',
  authorize('admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const [todayCount, weekCount, byType] = await Promise.all([
        prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.activityLog.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.activityLog.groupBy({
          by: ['activity'],
          _count: true,
          where: { createdAt: { gte: weekStart } },
          orderBy: { _count: { activity: 'desc' } },
          take: 10,
        }),
      ]);

      res.json({ todayCount, weekCount, byType });
    } catch (error) {
      next(error);
    }
  },
);
