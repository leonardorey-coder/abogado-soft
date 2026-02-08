import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const conveniosRouter = Router();
conveniosRouter.use(authenticate);

const createConvenioSchema = z.object({
  numero: z.string().min(1).max(100),
  institucion: z.string().min(1).max(255),
  departamento: z.string().max(255).optional(),
  descripcion: z.string().optional(),
  fechaInicio: z.string().date(),
  fechaFin: z.string().date(),
  estado: z.enum(['activo', 'pendiente', 'vencido', 'expirado', 'cancelado']).default('pendiente'),
  notas: z.string().optional(),
  monto: z.number().optional(),
});

const updateConvenioSchema = createConvenioSchema.partial();

const conveniosQuerySchema = paginationQuery.extend({
  estado: z.enum(['activo', 'pendiente', 'vencido', 'expirado', 'cancelado']).optional(),
  search: z.string().optional(),
});

// ─── GET /api/convenios ─────────────────────────────────────────────────────
conveniosRouter.get(
  '/',
  validateQuery(conveniosQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, estado, search } = req.query as any;
      const skip = (page - 1) * limit;
      const where: any = {};

      if (estado) where.estado = estado;
      if (search) {
        where.OR = [
          { numero: { contains: search, mode: 'insensitive' } },
          { institucion: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [convenios, total] = await Promise.all([
        prisma.convenio.findMany({
          where,
          skip,
          take: limit,
          orderBy: { fechaFin: sortOrder },
          include: {
            responsable: { select: { id: true, name: true, email: true } },
            _count: { select: { documents: true } },
          },
        }),
        prisma.convenio.count({ where }),
      ]);

      res.json({ data: convenios, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/convenios/:id ─────────────────────────────────────────────────
conveniosRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const convenio = await prisma.convenio.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          responsable: { select: { id: true, name: true, email: true } },
          documents: {
            include: {
              document: { select: { id: true, name: true, type: true, fileStatus: true } },
            },
          },
        },
      });
      res.json(convenio);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/convenios ────────────────────────────────────────────────────
conveniosRouter.post(
  '/',
  authorize('admin'),
  validate(createConvenioSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const convenio = await prisma.convenio.create({
        data: {
          ...data,
          responsableId: req.user!.id,
          fechaInicio: new Date(data.fechaInicio),
          fechaFin: new Date(data.fechaFin),
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CONVENIO_CREATED',
          entityType: 'convenio',
          entityId: convenio.id,
          entityName: `${convenio.numero} - ${convenio.institucion}`,
          description: `Convenio creado: ${convenio.numero}`,
        },
      });

      res.status(201).json(convenio);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/convenios/:id ───────────────────────────────────────────────
conveniosRouter.patch(
  '/:id',
  authorize('admin'),
  validateParams(uuidParam),
  validate(updateConvenioSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
      if (data.fechaFin) data.fechaFin = new Date(data.fechaFin);

      const convenio = await prisma.convenio.update({
        where: { id: req.params.id },
        data,
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CONVENIO_UPDATED',
          entityType: 'convenio',
          entityId: convenio.id,
          entityName: `${convenio.numero}`,
          description: `Convenio actualizado`,
        },
      });

      res.json(convenio);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/convenios/:id ──────────────────────────────────────────────
conveniosRouter.delete(
  '/:id',
  authorize('admin'),
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const convenio = await prisma.convenio.delete({
        where: { id: req.params.id },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CONVENIO_DELETED',
          entityType: 'convenio',
          entityId: convenio.id,
          entityName: convenio.numero,
          description: `Convenio eliminado: ${convenio.numero}`,
        },
      });

      res.json({ message: 'Convenio eliminado' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/convenios/:id/documents ──────────────────────────────────────
const linkDocSchema = z.object({
  documentId: z.string().uuid(),
});

conveniosRouter.post(
  '/:id/documents',
  validateParams(uuidParam),
  validate(linkDocSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const link = await prisma.convenioDocument.create({
        data: {
          convenioId: req.params.id,
          documentId: req.body.documentId,
          addedBy: req.user!.id,
        },
      });
      res.status(201).json(link);
    } catch (error) {
      next(error);
    }
  },
);
