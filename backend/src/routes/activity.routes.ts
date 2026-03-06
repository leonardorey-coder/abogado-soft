import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateQuery, paginationQuery } from '../middleware/validate.js';

export const activityRouter = Router();
activityRouter.use(authenticate);

// ─── Category → filter mapping ─────────────────────────────────────────────
const CATEGORY_FILTERS: Record<string, any> = {
  documents: { entityType: { in: ['document'] } },
  convenios: { entityType: { in: ['convenio'] } },
  team: {
    OR: [
      { entityType: { in: ['user', 'group'] } },
      { activity: { in: ['USER_REGISTERED', 'USER_UPDATED', 'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_DELETED', 'GROUP_MEMBER_ADDED', 'GROUP_MEMBER_REMOVED'] } },
    ],
  },
  security: {
    activity: { in: ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGED', 'ADMIN_ACCESS_GRANTED', 'ADMIN_ACCESS_DENIED', 'BACKUP_CREATED', 'BACKUP_RESTORED', 'SETTINGS_CHANGED'] },
  },
  assignments: {
    activity: { in: ['DOCUMENT_ASSIGNED', 'DOCUMENT_SHARED', 'COLLABORATION_STARTED', 'COLLABORATION_ENDED'] },
  },
};

const activityQuerySchema = paginationQuery.extend({
  userId: z.string().uuid().optional(),
  activity: z.string().optional(),
  entityType: z.string().optional(),
  category: z.enum(['documents', 'convenios', 'team', 'security', 'assignments']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/** Build shared where-clause from common query params */
function buildWhereClause(query: any, user: any): any {
  const { userId, activity, entityType, category, from, to } = query;
  const where: any = {};

  // Asistentes solo ven su propia actividad
  if (user.role !== 'admin') {
    where.userId = user.id;
  } else if (userId) {
    where.userId = userId;
  }

  // Category filter (takes precedence over individual entityType/activity)
  if (category && CATEGORY_FILTERS[category]) {
    const catFilter = CATEGORY_FILTERS[category];
    if (catFilter.OR) {
      where.OR = catFilter.OR;
    } else {
      Object.assign(where, catFilter);
    }
  } else {
    if (activity) where.activity = activity;
    if (entityType) where.entityType = entityType;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  return where;
}

// ─── GET /api/activity ──────────────────────────────────────────────────────
// Bitácora de actividad. Admin ve todo, asistente ve solo su actividad.
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
// Estadísticas de actividad para el dashboard.
activityRouter.get(
  '/stats',
  authorize('admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const [todayCount, weekCount, byType] = await Promise.all([
        prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.activityLog.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.activityLog.groupBy({
          by: ['activity'],
          _count: true,
          where: { createdAt: { gte: weekStart } },
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
