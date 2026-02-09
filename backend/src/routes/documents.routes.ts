// ============================================================================
// Documents Routes — CRUD, soft-delete, papelera, búsqueda, versiones, upload
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { mkdir } from 'fs/promises';
import multer from 'multer';
import mammoth from 'mammoth';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

// ─── BigInt → Number serialization helper ────────────────────────────────────
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
}

/** Express 5 types req.params values as string | string[]; this helper narrows to string. */
function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// ─── Multer config para subida de archivos ──────────────────────────────────
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

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

// ─── GET /api/documents/trash ───────────────────────────────────────────────
// MUST be defined before /:id so Express doesn't match "trash" as a UUID
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

      res.json({ data: serializeBigInt(documents), total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

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

      res.json({ data: serializeBigInt(documents), total, page, limit });
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
        where: { id: paramId(req) },
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
          assignments: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              assigner: { select: { id: true, name: true } },
            },
          },
        },
      });

      res.json(serializeBigInt(document));
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/upload ──────────────────────────────────────────────
documentsRouter.post(
  '/upload',
  uploadMiddleware.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: 'No se proporcionó un archivo válido' });
        return;
      }

      // Determine document type from extension
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      const typeMap: Record<string, string> = {
        doc: 'doc', docx: 'docx', pdf: 'pdf',
        xls: 'xls', xlsx: 'xlsx', txt: 'txt', rtf: 'rtf',
        jpg: 'pdf', jpeg: 'pdf', png: 'pdf', gif: 'pdf', webp: 'pdf',
      };
      const docType = typeMap[ext] ?? 'pdf';

      const document = await prisma.document.create({
        data: {
          name: req.body.name || file.originalname,
          type: docType as any,
          size: BigInt(file.size),
          localPath: file.path,
          mimeType: file.mimetype,
          ownerId: req.user!.id,
          description: req.body.description || undefined,
          groupId: req.body.groupId || undefined,
          caseId: req.body.caseId || undefined,
          tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_CREATED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Archivo subido: ${document.name} (${(file.size / 1024).toFixed(1)} KB)`,
        },
      });

      res.status(201).json(serializeBigInt(document));
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/file ────────────────────────────────────────────
// Sirve el archivo raw (para embedding en iframe/img, preview)
documentsRouter.get(
  '/:id/file',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
      });

      if (!doc.localPath) {
        res.status(404).json({ error: 'Archivo no disponible' });
        return;
      }

      if (doc.mimeType) {
        res.setHeader('Content-Type', doc.mimeType);
      }
      res.sendFile(path.resolve(doc.localPath));
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/download ────────────────────────────────────────
documentsRouter.get(
  '/:id/download',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
      });

      if (!doc.localPath) {
        res.status(404).json({ error: 'Archivo no disponible para descarga' });
        return;
      }

      res.download(path.resolve(doc.localPath), doc.name);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/content ──────────────────────────────────────────
// Extrae el contenido HTML de un DOCX para inicializar el editor colaborativo.
// Para TXT devuelve el texto envuelto en <p>. Otros formatos → 404.
documentsRouter.get(
  '/:id/content',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
      });

      if (!doc.localPath || !fs.existsSync(doc.localPath)) {
        res.status(404).json({ error: 'Archivo no disponible' });
        return;
      }

      const ext = path.extname(doc.name).toLowerCase();

      // DOCX → HTML via mammoth (with embedded images)
      if (ext === '.docx' || ext === '.doc') {
        const result = await mammoth.convertToHtml(
          { path: doc.localPath },
          {
            convertImage: mammoth.images.imgElement(async (image: any) => {
              const buf = await image.read();
              const base64 = Buffer.from(buf).toString('base64');
              const mime = image.contentType || 'image/png';
              return { src: `data:${mime};base64,${base64}` };
            }),
            styleMap: [
              "p[style-name='Title'] => h1:fresh",
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Subtitle'] => h2:fresh",
              "b => strong",
              "i => em",
              "u => u",
              "strike => s",
            ],
          },
        );
        res.json({ html: result.value, messages: result.messages });
        return;
      }

      // TXT / RTF → wrap in paragraphs
      if (ext === '.txt' || ext === '.rtf') {
        const raw = fs.readFileSync(doc.localPath, 'utf-8');
        const html = raw
          .split(/\n\n+/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        res.json({ html });
        return;
      }

      // PDF / images / spreadsheets → no text extraction
      res.status(404).json({ error: 'Este tipo de archivo no soporta extracción de contenido para el editor' });
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

      res.status(201).json(serializeBigInt(document));
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
        where: { id: paramId(req) },
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

      res.json(serializeBigInt(document));
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
        where: { id: paramId(req) },
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

// ─── DELETE /api/documents/:id/permanent ────────────────────────────────────
// Eliminación permanente — solo documentos que ya están en papelera
documentsRouter.delete(
  '/:id/permanent',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUnique({ where: { id: paramId(req) } });
      if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
      if (!doc.isDeleted) return res.status(400).json({ error: 'El documento debe estar en papelera para eliminarlo permanentemente' });

      // Eliminar archivo físico si existe
      if (doc.localPath) {
        const filePath = path.resolve(doc.localPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      // Eliminar versiones, comentarios, permisos, actividad y el documento
      await prisma.$transaction([
        prisma.documentVersion.deleteMany({ where: { documentId: doc.id } }),
        prisma.documentComment.deleteMany({ where: { documentId: doc.id } }),
        prisma.documentPermission.deleteMany({ where: { documentId: doc.id } }),
        prisma.activityLog.deleteMany({ where: { entityId: doc.id, entityType: 'document' } }),
        prisma.document.delete({ where: { id: doc.id } }),
      ]);

      res.json({ message: 'Documento eliminado permanentemente' });
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
        where: { id: paramId(req) },
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

      res.json(serializeBigInt(document));
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
        where: { id: paramId(req) },
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

      res.status(201).json(serializeBigInt(version));
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
          documentId: paramId(req),
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
          entityId: paramId(req),
          description: `Comentario agregado`,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);
