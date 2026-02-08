import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// ─── GET /api/notifications ─────────────────────────────────────────────────
notificationsRouter.get(
  '/',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;

      const [notifications, total, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: req.user!.id },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where: { userId: req.user!.id } }),
        prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
      ]);

      res.json({ data: notifications, total, unread, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/notifications/:id/read ──────────────────────────────────────
notificationsRouter.patch(
  '/:id/read',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await prisma.notification.update({
        where: { id: req.params.id, userId: req.user!.id },
        data: { isRead: true, readAt: new Date() },
      });
      res.json(notification);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/notifications/read-all ───────────────────────────────────────
notificationsRouter.post(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      res.json({ marked: result.count });
    } catch (error) {
      next(error);
    }
  },
);
