import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const groupsRouter = Router();
groupsRouter.use(authenticate);

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

// ─── GET /api/groups ────────────────────────────────────────────────────────
groupsRouter.get(
  '/',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;

      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where: {
            OR: [
              { ownerId: req.user!.id },
              { members: { some: { userId: req.user!.id } } },
            ],
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, name: true } },
            _count: { select: { members: true, documents: true } },
          },
        }),
        prisma.group.count({
          where: {
            OR: [
              { ownerId: req.user!.id },
              { members: { some: { userId: req.user!.id } } },
            ],
          },
        }),
      ]);

      res.json({ data: groups, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/groups/:id ────────────────────────────────────────────────────
groupsRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          _count: { select: { documents: true } },
        },
      });
      res.json(group);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/groups ───────────────────────────────────────────────────────
groupsRouter.post(
  '/',
  validate(createGroupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generar código de invitación
      const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

      const group = await prisma.group.create({
        data: {
          ...req.body,
          ownerId: req.user!.id,
          inviteCode,
        },
      });

      // El creador es miembro admin automáticamente
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: req.user!.id,
          role: 'admin',
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'GROUP_CREATED',
          entityType: 'group',
          entityId: group.id,
          entityName: group.name,
          description: `Grupo creado: ${group.name}`,
        },
      });

      res.status(201).json(group);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/groups/:id/members ───────────────────────────────────────────
groupsRouter.post(
  '/:id/members',
  validateParams(uuidParam),
  validate(addMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await prisma.groupMember.create({
        data: {
          groupId: req.params.id,
          userId: req.body.userId,
          role: req.body.role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'GROUP_MEMBER_ADDED',
          entityType: 'group',
          entityId: req.params.id,
          description: `Miembro ${member.user.name} agregado al grupo`,
        },
      });

      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/groups/:id/members/:userId ─────────────────────────────────
groupsRouter.delete(
  '/:id/members/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.groupMember.deleteMany({
        where: {
          groupId: req.params.id,
          userId: req.params.userId,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'GROUP_MEMBER_REMOVED',
          entityType: 'group',
          entityId: req.params.id,
        },
      });

      res.json({ message: 'Miembro eliminado del grupo' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/groups/join ──────────────────────────────────────────────────
const joinGroupSchema = z.object({
  inviteCode: z.string().min(1),
});

groupsRouter.post(
  '/join',
  validate(joinGroupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findFirst({
        where: { inviteCode: req.body.inviteCode, isActive: true },
      });

      if (!group) {
        res.status(404).json({ error: 'Código de invitación inválido' });
        return;
      }

      const member = await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: req.user!.id,
          role: 'viewer',
        },
      });

      res.status(201).json({ group: { id: group.id, name: group.name }, member });
    } catch (error) {
      next(error);
    }
  },
);
