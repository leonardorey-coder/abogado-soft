// ============================================================================
// Auth Middleware — Verifica JWT emitido por Supabase Auth
// Usa la API de Supabase Auth (getUser) para verificar el token de forma
// segura sin depender del JWT secret local.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

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

/**
 * Verifica un access_token contra la API de Supabase Auth.
 * Devuelve el user id (sub) si es válido, o null si no lo es.
 */
async function verifySupabaseToken(accessToken: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.id) return null;

    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

/**
 * Middleware principal: extrae el JWT del header Authorization,
 * lo verifica con Supabase Auth, y busca al usuario en la BD vía Prisma.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticación requerido' });
      return;
    }

    const token = authHeader.slice(7);

    // Verificar token contra Supabase Auth API
    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }

    // Buscar usuario en nuestra BD
    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
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
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    const supabaseUser = await verifySupabaseToken(token);

    if (supabaseUser) {
      const user = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });

      if (user?.isActive) {
        req.user = user;
      }
    }
  } catch {
    // Token inválido — continuar sin usuario
  }
  next();
}
