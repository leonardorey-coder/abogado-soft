import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

// ─── GET /api/users ──────────────────────────────────────────────────────────
// Lista usuarios (solo admin).
usersRouter.get(
  '/',
  authorize('admin'),
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder } = req.query as unknown as { page: number; limit: number; sortOrder: 'asc' | 'desc' };
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          select: {
            id: true, email: true, name: true, role: true,
            avatarUrl: true, officeName: true, isActive: true,
            lastLogin: true, createdAt: true,
          },
        }),
        prisma.user.count(),
      ]);

      res.json({ data: users, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/users/:id ─────────────────────────────────────────────────────
usersRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.params.id },
        select: {
          id: true, email: true, name: true, role: true,
          avatarUrl: true, officeName: true, department: true,
          position: true, isActive: true, lastLogin: true, createdAt: true,
        },
      });
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);
