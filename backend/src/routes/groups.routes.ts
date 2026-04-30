import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFirm } from '../middleware/requireFirm.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const groupsRouter = Router();
groupsRouter.use(authenticate);
// requireFirm se aplica por ruta — POST / y POST /join son accesibles sin firmId (onboarding)

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

// ─── GET /api/groups ────────────────────────────────────────────────────────
groupsRouter.get(
  '/',
  requireFirm,
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;
      const firmId = req.user!.firmId!;
      const accessWhere = {
        firmId,
        OR: [
          { ownerId: req.user!.id },
          { members: { some: { userId: req.user!.id } } },
        ],
      };

      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where: accessWhere,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, name: true } },
            _count: { select: { members: true, documents: true } },
          },
        }),
        prisma.group.count({ where: accessWhere }),
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
  requireFirm,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUniqueOrThrow({
        where: { id: req.params.id as string },
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

      // Si el usuario no tiene despacho, crear uno con el nombre del grupo
      let firmId = req.user!.firmId;
      if (!firmId) {
        const firm = await prisma.firm.create({
          data: { name: req.body.name.trim() },
        });
        firmId = firm.id;
        // Asignar el firmId al usuario
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { firmId, officeName: firm.name },
        });
        req.user!.firmId = firmId;
      }

      const group = await prisma.group.create({
        data: {
          ...req.body,
          firmId,
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
          firmId,
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

// ─── PATCH /api/groups/:id ──────────────────────────────────────────────────
groupsRouter.patch(
  '/:id',
  requireFirm,
  validateParams(uuidParam),
  validate(updateGroupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: req.params.id as string,
          userId: req.user!.id,
        },
      });

      const group = await prisma.group.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, ownerId: true, isActive: true, name: true },
      });

      if (!group || !group.isActive) {
        res.status(404).json({ error: 'Despacho no encontrado' });
        return;
      }

      const canManage = group.ownerId === req.user!.id || membership?.role === 'admin';
      if (!canManage) {
        res.status(403).json({ error: 'No tienes permisos para editar este despacho' });
        return;
      }

      const updated = await prisma.group.update({
        where: { id: req.params.id as string },
        data: {
          name: req.body.name.trim(),
          description: req.body.description?.trim() || null,
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'GROUP_UPDATED',
          entityType: 'group',
          entityId: updated.id,
          entityName: updated.name,
          description: `Despacho actualizado: ${updated.name}`,
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/groups/:id/members ───────────────────────────────────────────
groupsRouter.post(
  '/:id/members',
  requireFirm,
  validateParams(uuidParam),
  validate(addMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await prisma.groupMember.create({
        data: {
          groupId: req.params.id as string,
          userId: req.body.userId,
          role: req.body.role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'GROUP_MEMBER_ADDED',
          entityType: 'group',
          entityId: req.params.id as string,
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
  requireFirm,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.groupMember.deleteMany({
        where: {
          groupId: req.params.id as string,
          userId: req.params.userId as string,
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'GROUP_MEMBER_REMOVED',
          entityType: 'group',
          entityId: req.params.id as string,
        },
      });

      res.json({ message: 'Miembro eliminado del grupo' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/groups/:id ─────────────────────────────────────────────────
groupsRouter.delete(
  '/:id',
  requireFirm,
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: req.params.id as string,
          userId: req.user!.id,
        },
      });

      const group = await prisma.group.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, ownerId: true, isActive: true, name: true },
      });

      if (!group || !group.isActive) {
        res.status(404).json({ error: 'Despacho no encontrado' });
        return;
      }

      const canManage = group.ownerId === req.user!.id || membership?.role === 'admin';
      if (!canManage) {
        res.status(403).json({ error: 'No tienes permisos para eliminar este despacho' });
        return;
      }

      await prisma.group.update({
        where: { id: req.params.id as string },
        data: { isActive: false },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'GROUP_DELETED',
          entityType: 'group',
          entityId: group.id,
          entityName: group.name,
          description: `Despacho eliminado: ${group.name}`,
        },
      });

      res.json({ message: 'Despacho eliminado correctamente' });
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

      // Si el usuario no tiene despacho, asignarle el del grupo
      if (!req.user!.firmId) {
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { firmId: group.firmId },
        });
        req.user!.firmId = group.firmId;
      } else if (req.user!.firmId !== group.firmId) {
        // Seguridad: no permitir unirse a grupo de otro despacho
        res.status(403).json({ error: 'Este código pertenece a otro despacho.' });
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
