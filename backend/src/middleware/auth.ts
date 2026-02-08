// ============================================================================
// Auth Middleware — Verifica JWT emitido por Supabase Auth
// NO usa supabase-client. Decodifica el token con jsonwebtoken.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

// Payload del JWT de Supabase
interface SupabaseJwtPayload {
  sub: string;         // user id (UUID)
  email: string;
  role: string;        // 'authenticated'
  aud: string;         // 'authenticated'
  iss: string;         // supabase URL
  iat: number;
  exp: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

// Se adjunta al Request después de autenticar
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'asistente';
  isActive: boolean;
}

// Extiende Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

/**
 * Middleware principal: extrae y valida el JWT de Supabase del header Authorization.
 * Busca al usuario en la BD vía Prisma y lo adjunta a req.user.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticación requerido' });
      return;
    }

    const token = authHeader.slice(7);

    if (!JWT_SECRET) {
      console.error('SUPABASE_JWT_SECRET no configurado');
      res.status(500).json({ error: 'Error de configuración del servidor' });
      return;
    }

    // Verificar y decodificar el JWT
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as SupabaseJwtPayload;

    // Buscar usuario en nuestra BD
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
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
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    next(error);
  }
}

/**
 * Middleware de autorización: solo permite acceso a usuarios con rol específico.
 */
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

/**
 * Middleware opcional: intenta autenticar pero no falla si no hay token.
 * Útil para endpoints que funcionan diferente con/sin usuario.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ') || !JWT_SECRET) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as SupabaseJwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (user?.isActive) {
      req.user = user;
    }
  } catch {
    // Token inválido — continuar sin usuario
  }
  next();
}
