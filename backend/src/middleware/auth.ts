import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'asistente';
  isActive: boolean;
  firmId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const lastLoginUpdateMap = new Map<string, number>();
const sessionActivityUpdateMap = new Map<string, number>();
const LAST_LOGIN_THROTTLE_MS = 5 * 60 * 1000;
const SESSION_ACTIVITY_THROTTLE_MS = 60 * 1000;

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token = '';
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      res.status(401).json({ error: 'Token de autenticación requerido' });
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true, firmId: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Usuario no encontrado en el sistema' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Cuenta desactivada' });
      return;
    }

    req.user = user;

    const now = Date.now();
    const lastUpdate = lastLoginUpdateMap.get(user.id) ?? 0;
    if (now - lastUpdate > LAST_LOGIN_THROTTLE_MS) {
      lastLoginUpdateMap.set(user.id, now);
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }).catch(() => {});
    }

    const lastSessionUpdate = sessionActivityUpdateMap.get(user.id) ?? 0;
    if (now - lastSessionUpdate > SESSION_ACTIVITY_THROTTLE_MS) {
      sessionActivityUpdateMap.set(user.id, now);
      prisma.userSession.updateMany({
        where: {
          userId: user.id,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        data: { lastActivity: new Date() },
      }).catch(() => {});
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...roles: Array<'admin' | 'asistente'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token = '';
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload?.sub) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, name: true, role: true, isActive: true, firmId: true },
        });
        if (user?.isActive) {
          req.user = user;
        }
      }
    }
  } catch {
    // Token inválido — continuar sin usuario
  }
  next();
}
