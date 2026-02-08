import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}

/**
 * Error handler centralizado para Express.
 * Maneja errores de Zod (validación), Prisma (BD) y errores genéricos.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction,
): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  // ─── Errores de validación (Zod) ────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Error de validación',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // ─── Errores de Prisma ──────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        res.status(409).json({
          error: 'El registro ya existe',
          details: { fields: (err.meta as Record<string, unknown>)?.target },
          code: 'DUPLICATE',
        });
        return;
      case 'P2025': // Record not found
        res.status(404).json({
          error: 'Registro no encontrado',
          code: 'NOT_FOUND',
        });
        return;
      case 'P2003': // Foreign key constraint failed
        res.status(400).json({
          error: 'Referencia a registro inexistente',
          code: 'FK_VIOLATION',
        });
        return;
      default:
        res.status(400).json({
          error: 'Error de base de datos',
          details: err.message,
          code: err.code,
        });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Datos de entrada inválidos',
      code: 'PRISMA_VALIDATION',
    });
    return;
  }

  // ─── Error genérico ─────────────────────────────────────────────────────
  const statusCode = 'statusCode' in err ? (err as unknown as { statusCode: number }).statusCode : 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    code: 'INTERNAL_ERROR',
  });
}
