// ============================================================================
// Users Routes — CRUD completo de usuarios de "Mi Despacho"
// GET lista/detalle, POST crear, PATCH editar/rol/status, DELETE desactivar
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(255),
  role: z.enum(['admin', 'asistente']).default('asistente'),
  officeName: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  position: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  // La contraseña es enviada como texto y hasheada por Supabase Auth
  password: z.string().min(6),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  officeName: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});

const changeRoleSchema = z.object({
  role: z.enum(['admin', 'asistente']),
});

const changeStatusSchema = z.object({
  isActive: z.boolean(),
});

// ─── Query schema for users list (includes filter fields) ───────────────────
const usersListQuery = paginationQuery.extend({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z.string().optional(),
});

// ─── GET /api/users ──────────────────────────────────────────────────────────
// Lista usuarios del despacho con filtros opcionales.

usersRouter.get(
  '/',
  authorize('admin', 'asistente'),
  validateQuery(usersListQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder } = req.query as unknown as {
        page: number;
        limit: number;
        sortOrder: 'asc' | 'desc';
      };
      const skip = (page - 1) * limit;

      // Filtros opcionales por query string
      const search = (req.query.search as string) ?? '';
      const roleFilter = req.query.role as string | undefined;
      const statusFilter = req.query.isActive as string | undefined;

      const where = {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(roleFilter && { role: roleFilter as any }),
        ...(statusFilter !== undefined && { isActive: statusFilter === 'true' }),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          select: {
            id: true, email: true, name: true, role: true,
            avatarUrl: true, officeName: true, department: true,
            position: true, phone: true, isActive: true,
            lastLogin: true, createdAt: true, updatedAt: true,
          },
        }),
        prisma.user.count({ where }),
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
          position: true, phone: true, isActive: true,
          lastLogin: true, createdAt: true, updatedAt: true,
        },
      });
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/users ─────────────────────────────────────────────────────────
// Crear un nuevo usuario en el despacho (solo admin).

usersRouter.post(
  '/',
  authorize('admin'),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, role, officeName, department, position, phone, password } = req.body;

      // Verificar que el email no esté en uso
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
        return;
      }

      // Hashear contraseña con bcrypt (disponible en Bun)
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          name,
          role,
          passwordHash,
          officeName,
          department,
          position,
          phone,
          isActive: true,
        },
        select: {
          id: true, email: true, name: true, role: true,
          officeName: true, department: true, position: true,
          isActive: true, createdAt: true,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'USER_REGISTERED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: `Usuario creado por admin: ${user.email} (rol: ${role})`,
        },
      });

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/users/:id ────────────────────────────────────────────────────
// Editar datos de perfil de un usuario (admin puede editar cualquiera; usuario puede editar el suyo).

usersRouter.patch(
  '/:id',
  validateParams(uuidParam),
  validate(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetId = req.params.id;
      const isAdmin = req.user!.role === 'admin';
      const isSelf = req.user!.id === targetId;

      if (!isAdmin && !isSelf) {
        res.status(403).json({ error: 'Sin permiso para editar este usuario.' });
        return;
      }

      const { name, officeName, department, position, phone } = req.body;

      const user = await prisma.user.update({
        where: { id: targetId },
        data: {
          ...(name !== undefined && { name }),
          ...(officeName !== undefined && { officeName }),
          ...(department !== undefined && { department }),
          ...(position !== undefined && { position }),
          ...(phone !== undefined && { phone }),
        },
        select: {
          id: true, email: true, name: true, role: true,
          officeName: true, department: true, position: true,
          phone: true, isActive: true, updatedAt: true,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'USER_UPDATED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: `Perfil de usuario actualizado`,
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/users/:id/role ───────────────────────────────────────────────
// Cambiar rol de un usuario (solo admin).

usersRouter.patch(
  '/:id/role',
  authorize('admin'),
  validateParams(uuidParam),
  validate(changeRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body;
      const targetId = req.params.id;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'USER_UPDATED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: `Rol cambiado a: ${role}`,
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/users/:id/status ─────────────────────────────────────────────
// Activar o desactivar un usuario (soft-delete, solo admin).

usersRouter.patch(
  '/:id/status',
  authorize('admin'),
  validateParams(uuidParam),
  validate(changeStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive } = req.body;
      const targetId = req.params.id;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { isActive },
        select: { id: true, name: true, email: true, isActive: true },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'USER_UPDATED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: isActive ? 'Usuario reactivado' : 'Usuario desactivado',
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────
// Eliminación lógica (desactivar) de un usuario (solo admin).
// No se borra la cuenta de Supabase Auth para preservar logs históricos.

usersRouter.delete(
  '/:id',
  authorize('admin'),
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetId = req.params.id;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { isActive: false },
        select: { id: true, name: true, email: true },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'USER_UPDATED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: `Usuario desactivado (eliminación lógica)`,
        },
      });

      res.json({ message: 'Usuario desactivado exitosamente.', user });
    } catch (error) {
      next(error);
    }
  },
);
