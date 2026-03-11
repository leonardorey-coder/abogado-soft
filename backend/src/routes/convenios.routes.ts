import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import * as Diff from 'diff';
import { syncDocumentToDrive } from './drive.routes.js';
import { verifyCredentials } from '../lib/googleDrive.js';

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
          versions: {
            orderBy: { version: 'desc' },
            take: 10,
            include: { creator: { select: { id: true, name: true } } },
          },
          comments: {
            where: { isDeleted: false, parentId: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              replies: {
                where: { isDeleted: false },
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
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

      let syncResult = null;
      try {
        const driveReady = await verifyCredentials();
        if (driveReady) {
          syncResult = await syncDocumentToDrive(req.body.documentId, req.user!.id, 'Documento vinculado a convenio', { skipNewVersion: true });
        }
      } catch (syncError) {
        console.error('[Convenio] Auto-sync a Drive falló:', (syncError as Error).message);
        syncResult = { ok: false, error: (syncError as Error).message };
      }

      res.status(201).json({ ...link, syncResult });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/convenios/:id/documents/:documentId ────────────────────────
conveniosRouter.delete(
  '/:id/documents/:documentId',
  validateParams(z.object({ id: z.string().uuid(), documentId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.convenioDocument.delete({
        where: {
          convenioId_documentId: {
            convenioId: req.params.id,
            documentId: req.params.documentId,
          }
        },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/convenios/:id/versions ───────────────────────────────────────
const createVersionSchema = z.object({
  changeNote: z.string().optional(),
});

conveniosRouter.post(
  '/:id/versions',
  validateParams(uuidParam),
  validate(createVersionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conv = await prisma.convenio.findUniqueOrThrow({
        where: { id: req.params.id },
      });

      const newVersionNum = conv.version + 1;

      const [version] = await prisma.$transaction([
        prisma.convenioVersion.create({
          data: {
            convenioId: conv.id,
            version: newVersionNum,
            createdBy: req.user!.id,
            snapshotData: conv as any,
            changeNote: req.body.changeNote,
          },
        }),
        prisma.convenio.update({
          where: { id: conv.id },
          data: { version: newVersionNum },
        }),
      ]);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CONVENIO_VERSION_CREATED' as any,
          entityType: 'convenio',
          entityId: conv.id,
          entityName: conv.numero,
          description: `Nueva versión (v${newVersionNum}) del convenio: ${conv.numero}`,
          metadata: { version: newVersionNum, changeNote: req.body.changeNote },
        },
      });

      res.status(201).json(version);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/convenios/:id/comments ───────────────────────────────────────
const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
});

conveniosRouter.post(
  '/:id/comments',
  validateParams(uuidParam),
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.convenioComment.create({
        data: {
          convenioId: req.params.id,
          userId: req.user!.id,
          content: req.body.content,
          parentId: req.body.parentId,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CONVENIO_COMMENT_ADDED' as any,
          entityType: 'convenio',
          entityId: req.params.id,
          description: `Comentario agregado al convenio`,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/convenios/:id/diff ─────────────────────────────────────────────
conveniosRouter.get(
  '/:id/diff',
  validateParams(uuidParam),
  validateQuery(z.object({ v1: z.string(), v2: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const v1Num = parseInt(req.query.v1 as string, 10);
      const v2Num = parseInt(req.query.v2 as string, 10);

      const [ver1, ver2] = await Promise.all([
        prisma.convenioVersion.findUnique({
          where: { convenioId_version: { convenioId: req.params.id, version: v1Num } },
        }),
        prisma.convenioVersion.findUnique({
          where: { convenioId_version: { convenioId: req.params.id, version: v2Num } },
        }),
      ]);

      const text1 = ver1 ? JSON.stringify(ver1.snapshotData, null, 2) : '';
      const text2 = ver2 ? JSON.stringify(ver2.snapshotData, null, 2) : '';

      const diffs = Diff.diffLines(text1, text2);
      res.json(diffs);
    } catch (error) {
      next(error);
    }
  },
);
