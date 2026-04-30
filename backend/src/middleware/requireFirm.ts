// =============================================================================
// requireFirm.ts — Middleware que garantiza que el usuario tiene despacho asignado
//
// Debe aplicarse DESPUÉS de `authenticate` en todas las rutas que operan sobre
// recursos del despacho (documentos, convenios, expedientes, bitácora, etc.).
// =============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Bloquea el acceso si el usuario autenticado no tiene un `firmId` asignado.
 * Esto ocurre cuando un usuario fue creado con el flujo antiguo y aún no pertenece a ningún despacho.
 */
export function requireFirm(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  if (!req.user.firmId) {
    res.status(403).json({
      error: 'Tu cuenta no está asociada a ningún despacho. Contacta al administrador.',
      code: 'NO_FIRM',
    });
    return;
  }
  next();
}
