import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_EXPIRES_MS,
} from '../lib/jwt.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

// ─── Schemas ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(255),
  officeName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.enum(['admin', 'asistente']).default('asistente'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  officeName: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.enum(['admin', 'asistente']).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function issueTokens(userId: string, email: string, req: Request) {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId, email);

  await prisma.userSession.create({
    data: {
      userId,
      sessionToken: refreshToken,
      ipAddress: req.ip ?? null,
      deviceInfo: req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : undefined,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      isActive: true,
    },
  });

  return { accessToken, refreshToken };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof registerSchema>;

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        res.status(409).json({ error: 'Ya existe una cuenta con este correo.' });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          officeName: data.officeName,
          phone: data.phone,
          role: data.role,
        },
        select: { id: true, email: true, name: true, role: true, officeName: true, createdAt: true },
      });

      await prisma.userSettings.create({ data: { userId: user.id } });

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

      const { accessToken, refreshToken } = await issueTokens(user.id, user.email, req);

      res.status(201).json({ user, accessToken, refreshToken });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, email: true, name: true, role: true, avatarUrl: true,
          officeName: true, isActive: true, passwordHash: true,
          _count: { select: { groupMemberships: true } },
        },
      });

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: 'Cuenta desactivada.' });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        return;
      }

      const { accessToken, refreshToken } = await issueTokens(user.id, user.email, req);

      const { passwordHash: _ph, _count, ...safeUser } = user;

      res.json({
        user: { ...safeUser, needsProfileSetup: _count.groupMemberships === 0 },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

      const payload = verifyRefreshToken(refreshToken);
      if (!payload?.sub) {
        res.status(401).json({ error: 'Token de refresco inválido o expirado.' });
        return;
      }

      const session = await prisma.userSession.findUnique({
        where: { sessionToken: refreshToken },
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        res.status(401).json({ error: 'Sesión expirada. Inicie sesión de nuevo.' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, isActive: true },
      });

      if (!user?.isActive) {
        res.status(403).json({ error: 'Cuenta desactivada.' });
        return;
      }

      // Rotar refresh token: invalidar el anterior, emitir uno nuevo
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });

      const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user.id, user.email, req);

      res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

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
            include: { group: { select: { id: true, name: true, description: true } } },
          },
          _count: { select: { groupMemberships: true } },
        },
      });

      const { passwordHash: _ph, ...safeUser } = user as typeof user & { passwordHash?: string };

      res.json({
        ...safeUser,
        needsProfileSetup: user._count.groupMemberships === 0,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────

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
          id: true, email: true, name: true, role: true, avatarUrl: true,
          phone: true, officeName: true, department: true, position: true,
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };

      if (refreshToken) {
        await prisma.userSession.updateMany({
          where: { userId: req.user!.id, sessionToken: refreshToken },
          data: { isActive: false },
        });
      } else {
        // Invalidar todas las sesiones activas del usuario
        await prisma.userSession.updateMany({
          where: { userId: req.user!.id, isActive: true },
          data: { isActive: false },
        });
      }

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { lastLogin: new Date() },
      });

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
