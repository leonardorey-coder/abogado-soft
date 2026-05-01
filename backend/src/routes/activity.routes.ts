import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFirm } from '../middleware/requireFirm.js';
import { validateQuery, paginationQuery } from '../middleware/validate.js';

export const activityRouter = Router();
activityRouter.use(authenticate);
activityRouter.use(requireFirm);

// ─── Category → filter mapping ─────────────────────────────────────────────
const CATEGORY_FILTERS: Record<string, any> = {
  documents: { entityType: { in: ['document', 'calendar_note'] } },
  convenios: { entityType: { in: ['convenio'] } },
  team: {
    OR: [
      { entityType: { in: ['user', 'group'] } },
      { activity: { in: ['USER_REGISTERED', 'USER_UPDATED', 'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_DELETED', 'GROUP_MEMBER_ADDED', 'GROUP_MEMBER_REMOVED'] } },
    ],
  },
  security: {
    activity: {
      in: [
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGED',
        'ADMIN_ACCESS_GRANTED',
        'ADMIN_ACCESS_DENIED',
        'BACKUP_CREATED',
        'BACKUP_RESTORED',
        'SETTINGS_CHANGED',
      ],
    },
  },
  assignments: {
    activity: { in: ['DOCUMENT_ASSIGNED', 'DOCUMENT_SHARED', 'COLLABORATION_STARTED', 'COLLABORATION_ENDED', 'DOCUMENT_WORKFLOW_STATUS_CHANGED'] },
  },
};

const activityQuerySchema = paginationQuery.extend({
  userId: z.string().uuid().optional(),
  activity: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  category: z.enum(['documents', 'convenios', 'team', 'security', 'assignments']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Construye el where-clause de Prisma usando un array AND para evitar colisiones
 * entre el OR de aislamiento de firma y los OR de filtros de categoría.
 *
 * Reglas:
 *  - Con firmId: se muestra actividad del despacho (aislada por firma).
 *  - Admin puede filtrar por userId.
 *  - Sin firmId: solo su propia actividad.
 */
function buildWhereClause(query: any, user: any): any {
  const { userId: queryUserId, activity, entityType, entityId, category, from, to } = query;

  // Acumulador de condiciones (se combinan con AND implícito)
  const conditions: any[] = [];

  // ── 1. Aislamiento por despacho ──────────────────────────────────────────
  // Los logs sin firmId (creados durante onboarding) solo son visibles por su propio usuario.
  if (user.firmId) {
    conditions.push({
      OR: [
        { firmId: user.firmId },
        { firmId: null, userId: user.id },
      ],
    });
  } else {
    // Sin despacho: solo sus propios logs
    conditions.push({ userId: user.id });
  }

  // ── 2. Filtro opcional por usuario (cualquier rol) ────────────────────────
  // La visibilidad base ya está aislada por firma; este filtro solo refina.
  if (queryUserId) {
    conditions.push({ userId: queryUserId });
  }

  // ── 3. Filtro de categoría o entidad/actividad específica ─────────────────
  if (category && CATEGORY_FILTERS[category]) {
    // Añadir como condición AND separada — no sobreescribe el OR de firma
    conditions.push(CATEGORY_FILTERS[category]);
  } else {
    if (activity) conditions.push({ activity });
    if (entityType) conditions.push({ entityType });
  }

  // ── 4. Filtro por entidad específica ─────────────────────────────────────
  if (entityId) conditions.push({ entityId });

  // ── 5. Rango de fechas ────────────────────────────────────────────────────
  if (from || to) {
    const createdAt: any = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    conditions.push({ createdAt });
  }

  // Devolver AND si hay múltiples condiciones, o la única condición directamente
  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

// ─── GET /api/activity ──────────────────────────────────────────────────────
// Bitácora de actividad. Admin ve todo el despacho, asistente ve solo su actividad.
activityRouter.get(
  '/',
  validateQuery(activityQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder } = req.query as any;
      const skip = (page - 1) * limit;
      const where = buildWhereClause(req.query, req.user!);

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({ data: logs, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/activity/export ───────────────────────────────────────────────
// Exportar bitácora en formato CSV.
activityRouter.get(
  '/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where = buildWhereClause(req.query, req.user!);

      const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      });

      let csv = 'Fecha,Hora,Usuario,Acción,Tipo Entidad,Nombre Entidad\n';

      for (const log of logs) {
        const d = new Date(log.createdAt);
        const fecha = d.toLocaleDateString('es-ES');
        const hora = d.toLocaleTimeString('es-ES');
        const user = log.user?.name ? `"${log.user.name.replace(/"/g, '""')}"` : 'Sistema';
        const action = `"${log.activity}"`;
        const entType = log.entityType ? `"${log.entityType}"` : '';
        const entityName = log.entityName ? `"${log.entityName.replace(/"/g, '""')}"` : '';

        csv += `${fecha},${hora},${user},${action},${entType},${entityName}\n`;
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bitacora.csv"');
      res.send(Buffer.from('\uFEFF' + csv)); // Agregar BOM para Excel
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/activity/stats ────────────────────────────────────────────────
// Estadísticas de actividad del despacho (solo admin).
activityRouter.get(
  '/stats',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = req.user!.firmId;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      // Filtro base de firma para las estadísticas
      const firmFilter = firmId
        ? { OR: [{ firmId }, { firmId: null, userId: req.user!.id }] }
        : { userId: req.user!.id };

      const [todayCount, weekCount, byType] = await Promise.all([
        prisma.activityLog.count({ where: { AND: [firmFilter, { createdAt: { gte: todayStart } }] } }),
        prisma.activityLog.count({ where: { AND: [firmFilter, { createdAt: { gte: weekStart } }] } }),
        prisma.activityLog.groupBy({
          by: ['activity'],
          _count: true,
          where: { AND: [firmFilter, { createdAt: { gte: weekStart } }] },
          orderBy: { _count: { activity: 'desc' } },
          take: 10,
        }),
      ]);

      res.json({ todayCount, weekCount, byType });
    } catch (error) {
      next(error);
    }
  },
);
