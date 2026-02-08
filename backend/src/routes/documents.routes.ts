// ============================================================================
// Documents Routes — CRUD, soft-delete, papelera, búsqueda, versiones
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const documentsRouter = Router();
documentsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const createDocumentSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.enum(['docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt', 'rtf']),
  size: z.number().int().nonnegative().default(0),
  localPath: z.string().optional(),
  cloudUrl: z.string().url().optional(),
  groupId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mimeType: z.string().optional(),
  expirationDate: z.string().datetime().optional(),
});

const updateDocumentSchema = createDocumentSchema.partial().extend({
  fileStatus: z.enum(['ACTIVO', 'PENDIENTE', 'INACTIVO']).optional(),
  collaborationStatus: z.enum(['VISTO', 'EDITADO', 'COMENTADO', 'REVISADO', 'APROBADO', 'PENDIENTE_REVISION', 'RECHAZADO']).optional().nullable(),
  sharingStatus: z.enum(['ENVIADO', 'ASIGNADO']).optional().nullable(),
});

const documentsQuerySchema = paginationQuery.extend({
  search: z.string().optional(),
  type: z.enum(['docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt', 'rtf']).optional(),
  status: z.enum(['ACTIVO', 'PENDIENTE', 'INACTIVO']).optional(),
  groupId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

// ─── GET /api/documents ─────────────────────────────────────────────────────
documentsRouter.get(
  '/',
  validateQuery(documentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, search, type, status, groupId, caseId, includeDeleted } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {
        isDeleted: includeDeleted ? undefined : false,
        // Solo documentos propios o con permisos
        OR: [
          { ownerId: req.user!.id },
          { permissions: { some: { userId: req.user!.id } } },
          { group: { members: { some: { userId: req.user!.id } } } },
        ],
      };

      if (search) where.name = { contains: search, mode: 'insensitive' };
      if (type) where.type = type;
      if (status) where.fileStatus = status;
      if (groupId) where.groupId = groupId;
      if (caseId) where.caseId = caseId;

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: sortOrder },
          include: {
            owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            group: { select: { id: true, name: true } },
            case_: { select: { id: true, caseNumber: true, title: true } },
            _count: { select: { comments: true, versions: true, assignments: true } },
          },
        }),
        prisma.document.count({ where }),
      ]);

      res.json({ data: documents, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id ─────────────────────────────────────────────────
documentsRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          group: { select: { id: true, name: true } },
          case_: true,
          permissions: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              group: { select: { id: true, name: true } },
            },
          },
          versions: { orderBy: { version: 'desc' }, take: 10 },
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
          assignments: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              assigner: { select: { id: true, name: true } },
            },
          },
        },
      });

      res.json(document);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents ────────────────────────────────────────────────────
documentsRouter.post(
  '/',
  validate(createDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const document = await prisma.document.create({
        data: {
          ...data,
          ownerId: req.user!.id,
          size: BigInt(data.size),
          expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_CREATED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento creado: ${document.name}`,
        },
      });

      res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/documents/:id ───────────────────────────────────────────────
documentsRouter.patch(
  '/:id',
  validateParams(uuidParam),
  validate(updateDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.update({
        where: { id: req.params.id },
        data: req.body,
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_UPDATED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento actualizado: ${document.name}`,
          metadata: { fields: Object.keys(req.body) },
        },
      });

      res.json(document);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/documents/:id ──────────────────────────────────────────────
// Soft-delete → papelera
documentsRouter.delete(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.update({
        where: { id: req.params.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user!.id,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_DELETED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento enviado a papelera: ${document.name}`,
        },
      });

      res.json({ message: 'Documento enviado a papelera' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/restore ────────────────────────────────────────
documentsRouter.post(
  '/:id/restore',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.update({
        where: { id: req.params.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_RESTORED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento restaurado: ${document.name}`,
        },
      });

      res.json(document);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/trash ───────────────────────────────────────────────
documentsRouter.get(
  '/trash',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: { isDeleted: true, ownerId: req.user!.id },
          skip,
          take: limit,
          orderBy: { deletedAt: 'desc' },
          include: {
            deleter: { select: { id: true, name: true } },
          },
        }),
        prisma.document.count({ where: { isDeleted: true, ownerId: req.user!.id } }),
      ]);

      res.json({ data: documents, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/versions ───────────────────────────────────────
const createVersionSchema = z.object({
  changeNote: z.string().optional(),
  localPath: z.string().optional(),
  cloudUrl: z.string().url().optional(),
  size: z.number().int().nonnegative().default(0),
  checksum: z.string().optional(),
});

documentsRouter.post(
  '/:id/versions',
  validateParams(uuidParam),
  validate(createVersionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { id: true, version: true, name: true },
      });

      const newVersion = doc.version + 1;

      const [version] = await prisma.$transaction([
        prisma.documentVersion.create({
          data: {
            documentId: doc.id,
            version: newVersion,
            createdBy: req.user!.id,
            size: BigInt(req.body.size),
            changeNote: req.body.changeNote,
            localPath: req.body.localPath,
            cloudUrl: req.body.cloudUrl,
            checksum: req.body.checksum,
          },
        }),
        prisma.document.update({
          where: { id: doc.id },
          data: { version: newVersion },
        }),
      ]);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_VERSION_CREATED',
          entityType: 'document',
          entityId: doc.id,
          entityName: doc.name,
          description: `Nueva versión (v${newVersion}) de: ${doc.name}`,
          metadata: { version: newVersion, changeNote: req.body.changeNote },
        },
      });

      res.status(201).json(version);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/comments ───────────────────────────────────────
const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
  pageNumber: z.number().int().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

documentsRouter.post(
  '/:id/comments',
  validateParams(uuidParam),
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.documentComment.create({
        data: {
          documentId: req.params.id,
          userId: req.user!.id,
          ...req.body,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_COMMENT_ADDED',
          entityType: 'document',
          entityId: req.params.id,
          description: `Comentario agregado`,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);
