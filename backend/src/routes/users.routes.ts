// ============================================================================
// Users Routes — CRUD completo de usuarios de "Mi Despacho"
// GET lista/detalle, POST crear, PATCH editar/rol/status, DELETE desactivar
// Todos los endpoints filtran/validan por req.user.firmId (multi-tenancy)
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFirm } from '../middleware/requireFirm.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const usersRouter = Router();
usersRouter.use(authenticate);
usersRouter.use(requireFirm);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(255),
  role: z.enum(['admin', 'asistente']).default('asistente'),
  officeName: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  position: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  // La contraseña es enviada como texto y hasheada por el backend
  password: z.string().min(6),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  officeName: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().max(1_000_000).optional().nullable(),
  coverUrl: z.string().max(1_000_000).optional().nullable(),
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
      const firmId = req.user!.firmId!;

      const search = (req.query.search as string) ?? '';
      const roleFilter = req.query.role as string | undefined;
      const statusFilter = req.query.isActive as string | undefined;

      // Filtrar por despacho — solo usuarios del mismo Firm
      const baseWhere: any = {
        firmId,
        ...(roleFilter && { role: roleFilter as any }),
        ...(statusFilter !== undefined && { isActive: statusFilter === 'true' }),
      };

      const where = search
        ? { AND: [baseWhere, { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }] }
        : baseWhere;

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
      const firmId = req.user!.firmId!;

      const user = await prisma.user.findFirstOrThrow({
        where: { id: req.params.id as string, firmId },
        select: {
          id: true, email: true, name: true, role: true,
          avatarUrl: true, officeName: true, department: true,
          position: true, phone: true, isActive: true,
          lastLogin: true, createdAt: true, updatedAt: true,
          settings: { select: { storagePath: true } },
        },
      });
      const { settings, ...userData } = user;
      res.json({
        ...userData,
        coverUrl: settings?.storagePath ?? null,
      });
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
      const firmId = req.user!.firmId!;

      // Verificar que el email no esté en uso
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
        return;
      }

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
          firmId,                    // ← hereda el despacho del admin creador
        },
        select: {
          id: true, email: true, name: true, role: true,
          officeName: true, department: true, position: true,
          isActive: true, createdAt: true,
        },
      });

      await prisma.userSettings.create({ data: { userId: user.id } });

      await prisma.activityLog.create({
        data: {
          firmId,
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
      const targetId = req.params.id as string;
      const isAdmin = req.user!.role === 'admin';
      const isSelf = req.user!.id === targetId;
      const firmId = req.user!.firmId!;

      if (!isSelf) {
        if (!isAdmin) {
          res.status(403).json({ error: 'Sin permiso para editar este usuario.' });
          return;
        }
        const target = await prisma.user.findFirst({ where: { id: targetId, firmId } });
        if (!target) {
          res.status(403).json({ error: 'El usuario no pertenece a tu despacho.' });
          return;
        }
      }

      const before = await prisma.user.findFirst({
        where: isSelf ? { id: targetId } : { id: targetId, firmId },
        select: {
          name: true,
          officeName: true,
          department: true,
          position: true,
          phone: true,
          avatarUrl: true,
          settings: { select: { storagePath: true } },
        },
      });
      if (!before) {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }

      const { name, officeName, department, position, phone, avatarUrl, coverUrl } = req.body;

      const oldAvatar = before.avatarUrl?.trim() ? before.avatarUrl.trim() : null;
      const oldCover = before.settings?.storagePath?.trim() ? before.settings.storagePath.trim() : null;

      const fieldLabel: Record<string, string> = {
        name: 'Nombre',
        officeName: 'Despacho / Oficina',
        department: 'Área',
        position: 'Cargo',
        phone: 'Teléfono',
      };

      const toCleanValue = (v: unknown): string | null => {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s.length ? s : null;
      };

      const profileChanges: Array<{ key: keyof typeof fieldLabel; value: string | null }> = [];
      (['name', 'officeName', 'department', 'position', 'phone'] as const).forEach((k) => {
        if (req.body[k] === undefined) return;
        const next = toCleanValue(req.body[k]);
        const prev = toCleanValue((before as any)[k]);
        if (next !== prev) profileChanges.push({ key: k, value: next });
      });

      const user = await prisma.user.update({
        where: { id: targetId },
        data: {
          ...(name !== undefined && { name }),
          ...(officeName !== undefined && { officeName }),
          ...(department !== undefined && { department }),
          ...(position !== undefined && { position }),
          ...(phone !== undefined && { phone }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
        select: {
          id: true, email: true, name: true, role: true,
          officeName: true, department: true, position: true,
          phone: true, avatarUrl: true, isActive: true, updatedAt: true,
        },
      });

      if (coverUrl !== undefined) {
        await prisma.userSettings.upsert({
          where: { userId: targetId },
          update: { storagePath: coverUrl },
          create: { userId: targetId, storagePath: coverUrl },
        });
      }

      const settingsAfter = await prisma.userSettings.findUnique({
        where: { userId: targetId },
        select: { storagePath: true },
      });
      const resolvedCoverUrl = settingsAfter?.storagePath?.trim() ? settingsAfter.storagePath.trim() : null;

      type MediaActivity =
        | 'USER_AVATAR_UPLOADED'
        | 'USER_AVATAR_UPDATED'
        | 'USER_AVATAR_REMOVED'
        | 'USER_COVER_UPLOADED'
        | 'USER_COVER_UPDATED'
        | 'USER_COVER_REMOVED';

      const mediaLogs: Array<{ activity: MediaActivity; description: string }> = [];

      if (avatarUrl !== undefined) {
        const nextAvatar =
          avatarUrl === null || (typeof avatarUrl === 'string' && avatarUrl.trim() === '')
            ? null
            : String(avatarUrl).trim();
        if (nextAvatar !== oldAvatar) {
          if (nextAvatar === null) {
            mediaLogs.push({ activity: 'USER_AVATAR_REMOVED', description: 'Eliminó foto de perfil' });
          } else if (!oldAvatar) {
            mediaLogs.push({ activity: 'USER_AVATAR_UPLOADED', description: 'Subió foto de perfil' });
          } else {
            mediaLogs.push({ activity: 'USER_AVATAR_UPDATED', description: 'Cambió foto de perfil' });
          }
        }
      }

      if (coverUrl !== undefined) {
        const nextCover =
          coverUrl === null || (typeof coverUrl === 'string' && coverUrl.trim() === '')
            ? null
            : String(coverUrl).trim();
        if (nextCover !== oldCover) {
          if (nextCover === null) {
            mediaLogs.push({ activity: 'USER_COVER_REMOVED', description: 'Eliminó foto de portada' });
          } else if (!oldCover) {
            mediaLogs.push({ activity: 'USER_COVER_UPLOADED', description: 'Subió foto de portada' });
          } else {
            mediaLogs.push({ activity: 'USER_COVER_UPDATED', description: 'Cambió foto de portada' });
          }
        }
      }

      const hasProfileFields =
        name !== undefined ||
        officeName !== undefined ||
        department !== undefined ||
        position !== undefined ||
        phone !== undefined;

      const activityRows: Array<{
        activity: MediaActivity | 'USER_UPDATED';
        description: string;
      }> = [...mediaLogs];
      if (hasProfileFields) {
        const detail =
          profileChanges.length > 0
            ? profileChanges
              .map((c) => `${fieldLabel[c.key]}: ${c.value ?? '—'}`)
              .join(', ')
            : null;
        activityRows.push({
          activity: 'USER_UPDATED',
          description: detail ? `Actualizó perfil - ${detail}` : 'Actualizó perfil',
        });
      }

      if (activityRows.length > 0) {
        await prisma.$transaction(
          activityRows.map((row) =>
            prisma.activityLog.create({
              data: {
                firmId,
                userId: req.user!.id,
                activity: row.activity,
                entityType: 'user',
                entityId: user.id,
                entityName: user.name,
                description: row.description,
              },
            }),
          ),
        );
      }

      res.json({
        ...user,
        coverUrl: resolvedCoverUrl,
      });
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
      const targetId = req.params.id as string;
      const firmId = req.user!.firmId!;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
        return;
      }

      const target = await prisma.user.findFirst({ where: { id: targetId, firmId } });
      if (!target) {
        res.status(403).json({ error: 'El usuario no pertenece a tu despacho.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });

      await prisma.activityLog.create({
        data: {
          firmId,
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
      const targetId = req.params.id as string;
      const firmId = req.user!.firmId!;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
        return;
      }

      const target = await prisma.user.findFirst({ where: { id: targetId, firmId } });
      if (!target) {
        res.status(403).json({ error: 'El usuario no pertenece a tu despacho.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { isActive },
        select: { id: true, name: true, email: true, isActive: true },
      });

      await prisma.activityLog.create({
        data: {
          firmId,
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
      const targetId = req.params.id as string;
      const firmId = req.user!.firmId!;

      if (req.user!.id === targetId) {
        res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
        return;
      }

      const target = await prisma.user.findFirst({ where: { id: targetId, firmId } });
      if (!target) {
        res.status(403).json({ error: 'El usuario no pertenece a tu despacho.' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data: { isActive: false },
        select: { id: true, name: true, email: true },
      });

      await prisma.activityLog.create({
        data: {
          firmId,
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
