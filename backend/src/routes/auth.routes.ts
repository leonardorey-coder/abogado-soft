// ============================================================================
// Auth Routes — Registro, login, sesión, logout
// Supabase Auth emite el JWT; aquí sincronizamos el usuario en nuestra BD.
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

// ─── Schemas de validación ──────────────────────────────────────────────────

const registerSchema = z.object({
  id: z.string().uuid(),                        // ID del usuario creado en Supabase Auth
  email: z.string().email(),
  name: z.string().min(2).max(255),
  officeName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.enum(['admin', 'asistente']).default('asistente'),
});

const syncUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(255),
  avatarUrl: z.string().url().optional().nullable(),
});

// ─── POST /api/auth/register ────────────────────────────────────────────────
// Después de crear el usuario en Supabase Auth, el frontend llama aquí
// para crear el perfil en nuestra BD.
authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const user = await prisma.user.create({
        data: {
          id: data.id,
          email: data.email,
          name: data.name,
          officeName: data.officeName,
          phone: data.phone,
          role: data.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          officeName: true,
          createdAt: true,
        },
      });

      // Crear settings por defecto
      await prisma.userSettings.create({
        data: { userId: user.id },
      });

      // Registrar en bitácora
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activity: 'USER_REGISTERED',
          entityType: 'user',
          entityId: user.id,
          entityName: user.name,
          description: `Nuevo usuario registrado: ${user.name} (${user.email})`,
        },
      });

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/auth/sync ────────────────────────────────────────────────────
// Sincroniza datos del usuario de Supabase Auth con nuestra BD (ej. OAuth).
authRouter.post(
  '/sync',
  validate(syncUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const user = await prisma.user.upsert({
        where: { id: data.id },
        update: {
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          lastLogin: new Date(),
        },
        create: {
          id: data.id,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          lastLogin: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          officeName: true,
          isActive: true,
          _count: { select: { groupMemberships: true } },
        },
      });

      // Crear settings por defecto si es usuario nuevo
      await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      res.json({
        ...user,
        needsProfileSetup: user._count.groupMemberships === 0,
        _count: undefined,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
// Obtiene el perfil completo del usuario autenticado.
authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user!.id },
        include: {
          settings: true,
          groupMemberships: {
            include: { group: { select: { id: true, name: true } } },
          },
          _count: { select: { groupMemberships: true } },
        },
      });

      res.json({
        ...user,
        needsProfileSetup: user._count.groupMemberships === 0,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/auth/me ─────────────────────────────────────────────────────
// Actualiza el perfil del usuario autenticado.
const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  officeName: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.enum(['admin', 'asistente']).optional(),
});

authRouter.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: req.body,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          phone: true,
          officeName: true,
          department: true,
          position: true,
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/auth/logout ──────────────────────────────────────────────────
// Registra la acción de logout en la bitácora.
authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'LOGOUT',
          entityType: 'user',
          entityId: req.user!.id,
          description: `${req.user!.name} cerró sesión`,
        },
      });

      res.json({ message: 'Sesión cerrada' });
    } catch (error) {
      next(error);
    }
  },
);
