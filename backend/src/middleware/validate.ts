import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ParamsFlatDictionary } from 'express-serve-static-core';

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

/**
 * Extiende Request de Express con params garantizados como string-only.
 * Úsalo en los handlers de rutas que usen validateParams().
 */
export interface TypedRequest<P extends ParamsFlatDictionary = ParamsFlatDictionary>
  extends Request {
  params: P;
}

/**
 * Middleware factory que valida req.body contra un schema Zod.
 * Si falla, lanza ZodError que el errorHandler captura.
 */
export function validate<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

/**
 * Middleware factory que valida req.query contra un schema Zod.
 * Express 5 hace req.query readonly, así que usamos Object.defineProperty.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.query);
    Object.defineProperty(req, 'query', {
      value: parsed,
      writable: true,
      configurable: true,
    });
    next();
  };
}

/**
 * Middleware factory que valida req.params contra un schema Zod y reemplaza
 * req.params con el objeto validado (garantizado como Record<string, string>).
 * Express 5 hace req.params readonly, así que usamos Object.defineProperty.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.params) as ParamsFlatDictionary;
    Object.defineProperty(req, 'params', {
      value: parsed,
      writable: true,
      configurable: true,
    });
    next();
  };
}

// ─── Schemas reutilizables ──────────────────────────────────────────────────

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;
