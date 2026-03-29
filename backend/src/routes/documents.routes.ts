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
import { authenticate, authorize } from '../middleware/auth.js';
import { requirePermission, getEffectivePermission } from '../middleware/checkPermission.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import * as Diff from 'diff';
import * as pdfParseModule from 'pdf-parse';
import * as XLSX from 'xlsx';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { syncDocumentToDrive } from './drive.routes.js';
import { verifyCredentials } from '../lib/googleDrive.js';

// ─── Diff summary helper ──────────────────────────────────────────────────────


async function extractTextFromPath(filePath: string | null): Promise<string> {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt' || ext === '.rtf') return fs.readFileSync(filePath, 'utf-8');
  if (ext === '.docx' || ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch { return ''; }
  }
  if (ext === '.pdf') {
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text || '';
    } catch { return ''; }
  }
  return '';
}

interface DiffSummary {
  linesAdded: number;
  linesRemoved: number;
  sampleLines: { type: 'added' | 'removed'; content: string }[];
}

async function computeDiffSummary(oldPath: string | null, newPath: string | null): Promise<DiffSummary | null> {
  try {
    const [oldText, newText] = await Promise.all([
      extractTextFromPath(oldPath),
      extractTextFromPath(newPath),
    ]);
    if (!oldText && !newText) return null;
    const diffs = Diff.diffLines(oldText, newText);
    let linesAdded = 0;
    let linesRemoved = 0;
    const addedSamples: { type: 'added'; content: string }[] = [];
    const removedSamples: { type: 'removed'; content: string }[] = [];
    for (const part of diffs) {
      const lines = (part.value || '').split('\n').filter(l => l.trim());
      if (part.added) {
        linesAdded += lines.length;
        for (const l of lines) {
          if (addedSamples.length < 3) addedSamples.push({ type: 'added', content: l.slice(0, 120) });
        }
      } else if (part.removed) {
        linesRemoved += lines.length;
        for (const l of lines) {
          if (removedSamples.length < 3) removedSamples.push({ type: 'removed', content: l.slice(0, 120) });
        }
      }
    }
    if (linesAdded === 0 && linesRemoved === 0) return null;
    return { linesAdded, linesRemoved, sampleLines: [...removedSamples, ...addedSamples] };
  } catch {
    return null;
  }
}


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

/**
 * Resuelve la ruta del archivo: si es absoluta la usa tal cual,
 * si es relativa (solo nombre de archivo) busca en uploads/.
 */
function resolveFilePath(localPath: string): string {
  if (path.isAbsolute(localPath)) {
    return localPath;
  }
  // Path relativo → buscar en uploads/
  const inUploads = path.join(process.cwd(), 'uploads', localPath);
  if (fs.existsSync(inUploads)) {
    return inUploads;
  }
  // Fallback: resolver desde cwd
  return path.resolve(localPath);
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

// ─── GET /api/documents/recently-opened ────────────────────────────────────
// MUST be defined before /:id so Express doesn't match it as a UUID
documentsRouter.get(
  '/recently-opened',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 30);
      const userId = req.user!.id;

      // Get the most recent unique documents/convenios opened (DOCUMENT_VIEWED)
      // using a subquery to deduplicate by entityId keeping the most recent
      const recentLogs = await prisma.activityLog.findMany({
        where: {
          userId,
          activity: 'DOCUMENT_VIEWED',
          entityId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 4, // fetch extra to deduplicate
        select: {
          entityId: true,
          entityType: true,
          entityName: true,
          createdAt: true,
          metadata: true,
        },
      });

      // Deduplicate: keep only the most recently opened occurrence of each entityId
      const seen = new Set<string>();
      const unique: typeof recentLogs = [];
      for (const log of recentLogs) {
        if (!log.entityId || seen.has(log.entityId)) continue;
        seen.add(log.entityId);
        unique.push(log);
        if (unique.length >= limit) break;
      }

      // Fetch document details for each entry
      const results: any[] = [];
      for (const log of unique) {
        try {
          if (log.entityType === 'document') {
            const doc = await prisma.document.findUnique({
              where: { id: log.entityId!, isDeleted: false },
              select: {
                id: true,
                name: true,
                type: true,
                fileStatus: true,
                updatedAt: true,
                mimeType: true,
                owner: { select: { id: true, name: true } },
              },
            });
            if (doc) {
              results.push({
                ...doc,
                entityType: 'document',
                openedAt: log.createdAt,
              });
            }
          } else if (log.entityType === 'convenio') {
            const conv = await prisma.convenio.findUnique({
              where: { id: log.entityId! },
              select: {
                id: true,
                numero: true,
                institucion: true,
                estado: true,
                updatedAt: true,
                responsable: { select: { id: true, name: true } },
              },
            });
            if (conv) {
              results.push({
                ...conv,
                name: `${conv.numero} – ${conv.institucion}`,
                entityType: 'convenio',
                openedAt: log.createdAt,
              });
            }
          }
        } catch {
          // skip entities that no longer exist
        }
      }

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  },
);

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
// Lista documentos del usuario según permisos:
// 1. Documentos propios (ownerId)
// 2. Documentos con permiso explícito individual (DocumentPermission.userId)
// 3. Documentos del grupo con permiso de grupo (DocumentPermission.groupId)
// 4. Documentos del grupo donde el usuario es miembro Y tiene al menos permiso 'download'
documentsRouter.get(
  '/',
  validateQuery(documentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, search, type, status, groupId, caseId, includeDeleted } = req.query as any;
      const skip = (page - 1) * limit;
      const userId = req.user!.id;
      const now = new Date();

      // Verificar si el usuario es admin global
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const isGlobalAdmin = user?.role === 'admin';

      // Obtener los grupos del usuario
      const userGroups = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      const userGroupIds = userGroups.map(g => g.groupId);

      // Construir condiciones de acceso basadas en permisos
      const accessConditions: any[] = [
        // 1. Es dueño del documento
        { ownerId: userId },
        // 2. Tiene permiso individual explícito (no expirado)
        {
          permissions: {
            some: {
              userId,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
          },
        },
      ];

      // 3. Si pertenece a grupos, agregar documentos del grupo con permisos
      if (userGroupIds.length > 0) {
        accessConditions.push(
          // Documentos del grupo donde hay un permiso de grupo válido
          {
            AND: [
              { groupId: { in: userGroupIds } },
              {
                permissions: {
                  some: {
                    groupId: { in: userGroupIds },
                    OR: [
                      { expiresAt: null },
                      { expiresAt: { gt: now } },
                    ],
                  },
                },
              },
            ],
          },
          // Documentos del grupo sin permisos explícitos (acceso por membresía)
          // Solo si el documento pertenece al grupo y no tiene restricciones de permisos
          {
            AND: [
              { groupId: { in: userGroupIds } },
              {
                permissions: {
                  none: {
                    permissionLevel: 'none',
                    OR: [
                      { userId },
                      { groupId: { in: userGroupIds } },
                    ],
                  },
                },
              },
            ],
          }
        );
      }

      const where: any = {
        isDeleted: includeDeleted ? undefined : false,
        // Si es admin global, puede ver todo; si no, aplicar filtros de acceso
        ...(isGlobalAdmin ? {} : { OR: accessConditions }),
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
            permissions: {
              where: {
                OR: [
                  { userId },
                  ...(userGroupIds.length > 0 ? [{ groupId: { in: userGroupIds } }] : []),
                ],
              },
              select: { permissionLevel: true, userId: true, groupId: true },
            },
            _count: { select: { comments: true, versions: true, assignments: true } },
            assignments: {
              include: {
                assignee: { select: { id: true, name: true, email: true, avatarUrl: true } }
              }
            }
          },
        }),
        prisma.document.count({ where }),
      ]);

      // Calcular permiso efectivo para cada documento y filtrar los que no tienen acceso
      const documentsWithPermissions = documents.map(doc => {
        let effectivePermission: string = 'none';

        // 1. Si es dueño → admin
        if (doc.ownerId === userId) {
          effectivePermission = 'admin';
        }
        // 2. Si es admin global → admin
        else if (isGlobalAdmin) {
          effectivePermission = 'admin';
        }
        // 3. Buscar el permiso más alto entre los permisos individuales y de grupo
        else if (doc.permissions.length > 0) {
          const levels = { none: 0, download: 1, read: 2, write: 3, admin: 4 };
          let maxLevel = 0;
          for (const perm of doc.permissions) {
            const level = levels[perm.permissionLevel as keyof typeof levels] ?? 0;
            if (level > maxLevel) maxLevel = level;
          }
          effectivePermission = Object.entries(levels).find(([, v]) => v === maxLevel)?.[0] ?? 'none';
        }
        // 4. Si es miembro del grupo y no hay permisos explícitos, dar acceso de lectura por defecto
        else if (doc.groupId && userGroupIds.includes(doc.groupId)) {
          effectivePermission = 'read';
        }

        // Remover el campo permissions del response (solo era para cálculo interno)
        const { permissions, ...docWithoutInternalPerms } = doc;

        return {
          ...docWithoutInternalPerms,
          effectivePermission,
        };
      });

      // Filtrar documentos sin acceso (permiso 'none')
      const accessibleDocuments = documentsWithPermissions.filter(
        doc => doc.effectivePermission !== 'none'
      );

      // Obtener historial de shares para cada documento
      const docIds = accessibleDocuments.map(d => d.id);
      const shareActivities = await prisma.activityLog.findMany({
        where: {
          entityId: { in: docIds },
          entityType: 'document',
          activity: 'DOCUMENT_SHARED',
        },
        orderBy: { createdAt: 'desc' },
        select: {
          entityId: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      });

      // Agrupar shares por documento (máximo 3 más recientes por documento)
      const sharesByDoc = new Map<string, Array<{ sharedWith: string; shareMethod: string; sharedAt: Date; sharedBy: { id: string; name: string } | null }>>();
      for (const share of shareActivities) {
        if (!share.entityId) continue;
        const existing = sharesByDoc.get(share.entityId) || [];
        if (existing.length < 3) {
          existing.push({
            sharedWith: (share.metadata as any)?.sharedWith || 'Desconocido',
            shareMethod: (share.metadata as any)?.shareMethod || 'system',
            sharedAt: share.createdAt,
            sharedBy: share.user,
          });
          sharesByDoc.set(share.entityId, existing);
        }
      }

      // Agregar shares a cada documento
      const documentsWithShares = accessibleDocuments.map(doc => ({
        ...doc,
        recentShares: sharesByDoc.get(doc.id) || [],
      }));

      res.json({ data: serializeBigInt(documentsWithShares), total: accessibleDocuments.length, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id ─────────────────────────────────────────────────
documentsRouter.get(
  '/:id',
  validateParams(uuidParam),
  requirePermission('download'),
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

      // ── Fire-and-forget: DOCUMENT_VIEWED + auto-transición de asignación ──
      (async () => {
        try {
          const docId = paramId(req);

          // Registrar apertura para "Abierto recientemente"
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              activity: 'DOCUMENT_VIEWED',
              entityType: 'document',
              entityId: docId,
              entityName: document.name,
              description: `Documento abierto: ${document.name}`,
            },
          });

          // Auto-transición de asignación: pendiente → visto
          const pendingAssignments = await prisma.documentAssignment.findMany({
            where: {
              documentId: docId,
              assignedTo: req.user!.id,
              status: 'pendiente',
            },
            select: { id: true },
          });

          if (pendingAssignments.length === 0) return;

          await prisma.documentAssignment.updateMany({
            where: { id: { in: pendingAssignments.map(a => a.id) } },
            data: { status: 'visto' },
          });

          await prisma.activityLog.createMany({
            data: pendingAssignments.map(a => ({
              userId: req.user!.id,
              activity: 'COLLABORATION_STARTED',
              entityType: 'document',
              entityId: docId,
              entityName: document.name,
              description: 'Estado automático de asignación: Pendiente → Visto',
              metadata: {
                assignmentId: a.id,
                fromStatus: 'pendiente',
                toStatus: 'visto',
                automatic: true,
              },
            })),
          });
        } catch (err) {
          console.error('[Document open tracking] Error:', err);
        }
      })();
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

      // Obtener el primer grupo del usuario si no se proporciona groupId
      let defaultGroupId = req.body.groupId;
      if (!defaultGroupId) {
        const userGroup = await prisma.groupMember.findFirst({
          where: { userId: req.user!.id },
          select: { groupId: true }
        });
        if (userGroup) {
          defaultGroupId = userGroup.groupId;
        }
      }

      const document = await prisma.document.create({
        data: {
          name: req.body.name || file.originalname,
          type: docType as any,
          size: BigInt(file.size),
          localPath: file.path,
          mimeType: file.mimetype,
          ownerId: req.user!.id,
          description: req.body.description || undefined,
          groupId: defaultGroupId || undefined,
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

      // Auto-sync a Google Drive para nuevos documentos
      let syncResult = null;
      try {
        const driveReady = await verifyCredentials();
        if (driveReady) {
          syncResult = await syncDocumentToDrive(document.id, req.user!.id, undefined, { skipNewVersion: true });
        }
      } catch (syncError) {
        console.error('[Upload] Auto-sync a Drive falló:', (syncError as Error).message);
        syncResult = { ok: false, error: (syncError as Error).message };
      }

      const freshDocument = await prisma.document.findUniqueOrThrow({
        where: { id: document.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      res.status(201).json(serializeBigInt({
        ...freshDocument,
        syncResult,
      }));
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
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
      });

      let targetPath = doc.localPath;
      let targetMime = doc.mimeType;

      const versionQuery = req.query.version;
      if (versionQuery) {
        const ver = await prisma.documentVersion.findFirst({
          where: { documentId: paramId(req), version: parseInt(versionQuery as string, 10) }
        });
        if (ver && ver.localPath) {
          targetPath = ver.localPath;
        }
      }

      if (!targetPath) {
        res.status(404).json({ error: 'Archivo no disponible' });
        return;
      }

      if (targetMime) {
        res.setHeader('Content-Type', targetMime);
      }
      res.sendFile(resolveFilePath(targetPath));
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/versions/:versionId/file ────────────────────────
documentsRouter.get(
  '/:id/versions/:versionId/file',
  validateParams(z.object({ id: z.string().uuid(), versionId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const verId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;

      const version = await prisma.documentVersion.findUniqueOrThrow({
        where: { id: verId, documentId: docId },
        include: { document: { select: { mimeType: true } } }
      });

      if (!version.localPath || !fs.existsSync(version.localPath)) {
        res.status(404).json({ error: 'Archivo de versión no disponible' });
        return;
      }

      if (version.document.mimeType) {
        res.setHeader('Content-Type', version.document.mimeType);
      }
      res.sendFile(path.resolve(version.localPath));
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/download ────────────────────────────────────────
documentsRouter.get(
  '/:id/download',
  validateParams(uuidParam),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
      });

      if (!doc.localPath) {
        res.status(404).json({ error: 'Archivo no disponible para descarga' });
        return;
      }

      res.download(resolveFilePath(doc.localPath), doc.name);
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
  requirePermission('read'),
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

      let defaultGroupId = data.groupId;
      if (!defaultGroupId) {
        const userGroup = await prisma.groupMember.findFirst({
          where: { userId: req.user!.id },
          select: { groupId: true }
        });
        if (userGroup) {
          defaultGroupId = userGroup.groupId;
        }
      }

      const document = await prisma.document.create({
        data: {
          ...data,
          ownerId: req.user!.id,
          groupId: defaultGroupId || undefined,
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
  requirePermission('write'),
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
  requirePermission('admin'),
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
  requirePermission('admin'),
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

const updateVersionSchema = z.object({
  changeNote: z.string().trim().max(300).nullable().optional(),
});

documentsRouter.post(
  '/:id/versions',
  validateParams(uuidParam),
  requirePermission('write'),
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

// ─── PATCH /api/documents/:id/versions/:versionId ────────────────────────────
documentsRouter.patch(
  '/:id/versions/:versionId',
  validateParams(z.object({ id: z.string().uuid(), versionId: z.string().uuid() })),
  requirePermission('write'),
  validate(updateVersionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = paramId(req);
      const versionId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;
      const nextChangeNote = req.body.changeNote === undefined ? null : req.body.changeNote;

      const existingVersion = await prisma.documentVersion.findFirst({
        where: { id: versionId, documentId },
        select: { id: true },
      });

      if (!existingVersion) {
        res.status(404).json({ error: 'Versión no encontrada para este documento.' });
        return;
      }

      const version = await prisma.documentVersion.update({
        where: { id: versionId },
        data: { changeNote: nextChangeNote },
      });

      res.json(serializeBigInt(version));
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
  requirePermission('read'),
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

// ─── GET /api/documents/:id/diff ─────────────────────────────────────────────
// @ts-expect-error No types available for htmldiff-js
import HtmlDiff from 'htmldiff-js';

documentsRouter.get(
  '/:id/diff',
  validateParams(uuidParam),
  validateQuery(z.object({ v1: z.string(), v2: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const v1Num = parseInt(req.query.v1 as string, 10);
      const v2Num = parseInt(req.query.v2 as string, 10);

      const [ver1, ver2] = await Promise.all([
        prisma.documentVersion.findUnique({
          where: { documentId_version: { documentId: paramId(req), version: v1Num } },
        }),
        prisma.documentVersion.findUnique({
          where: { documentId_version: { documentId: paramId(req), version: v2Num } },
        }),
      ]);

      const extractHtml = async (ver: any) => {
        if (!ver || !ver.localPath || !fs.existsSync(ver.localPath)) return '';
        const ext = path.extname(ver.localPath).toLowerCase();

        if (ext === '.txt' || ext === '.rtf') {
          const raw = fs.readFileSync(ver.localPath, 'utf-8');
          return raw.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        }
        if (ext === '.docx' || ext === '.doc') {
          const result = await mammoth.convertToHtml(
            { path: ver.localPath },
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
          return result.value || '';
        }
        if (ext === '.pdf') {
          const dataBuffer = fs.readFileSync(ver.localPath);
          const data = await pdfParse(dataBuffer);
          const raw = data.text || '';
          return raw.split(/\n\n+/).map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        }
        return '';
      };

      const [html1, html2] = await Promise.all([extractHtml(ver1), extractHtml(ver2)]);

      const diffHtml = HtmlDiff.execute(html1, html2);

      res.json({ html: diffHtml });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/save ────────────────────────────────────────────
// Endpoint unificado: recibe el archivo del editor, lo guarda localmente.
// Si createVersion=true, crea nueva versión en DB. Si no, solo sobreescribe.
// Auto-sync a Google Drive si está configurado.

documentsRouter.post(
  '/:id/save',
  validateParams(uuidParam),
  requirePermission('write'),
  uploadMiddleware.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const changeNote = req.body.changeNote ?? null;
      const createVersion = req.body.createVersion === 'true';

      // 1. Verificar que el documento existe
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: {
          id: true, name: true, type: true, localPath: true,
          version: true, driveFileId: true, ownerId: true,
        },
      });

      // 2. Guardar archivo subido
      if (!req.file) {
        res.status(400).json({ error: 'No se recibió ningún archivo.' });
        return;
      }

      const fileSize = req.file.size;

      if (createVersion) {
        // ── Modo "Nueva Versión": incrementar versión y crear registro ──
        const newVersion = doc.version + 1;
        const diffSummary = await computeDiffSummary(doc.localPath, req.file.path);

        await prisma.$transaction([
          prisma.document.update({
            where: { id: docId },
            data: {
              localPath: req.file.path,
              size: BigInt(fileSize),
              version: newVersion,
              updatedAt: new Date(),
            },
          }),
          prisma.documentVersion.create({
            data: {
              documentId: docId,
              version: newVersion,
              localPath: req.file.path,
              size: BigInt(fileSize),
              changeNote,
              createdBy: req.user!.id,
            } as any,
          }),
          prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              activity: 'DOCUMENT_VERSION_CREATED',
              entityType: 'document',
              entityId: docId,
              entityName: doc.name,
              description: `Nueva versión ${newVersion} guardada${changeNote ? `: ${changeNote}` : ''}`,
              metadata: diffSummary ? ({ diffSummary } as any) : undefined,
            },
          }),
        ]);

        // Auto-sync a Google Drive (versión ya creada aquí; no crear otra en Drive)
        let syncResult = null;
        try {
          const driveReady = await verifyCredentials();
          if (driveReady) {
            syncResult = await syncDocumentToDrive(docId, req.user!.id, changeNote, { skipNewVersion: true });
          }
        } catch (syncError) {
          console.error('[Save] Auto-sync a Drive falló:', (syncError as Error).message);
          syncResult = { ok: false, error: (syncError as Error).message };
        }

        res.json(serializeBigInt({
          ok: true,
          version: newVersion,
          size: fileSize,
          localPath: req.file.path,
          syncResult,
        }));
      } else {
        const diffSummary = await computeDiffSummary(doc.localPath, req.file.path);

        await prisma.document.update({
          where: { id: docId },
          data: {
            localPath: req.file.path,
            size: BigInt(fileSize),
            updatedAt: new Date(),
          },
        });

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'DOCUMENT_UPDATED',
            entityType: 'document',
            entityId: docId,
            entityName: doc.name,
            description: `Documento editado: ${doc.name}`,
            metadata: ({ source: 'editor_save', createVersion: false, size: fileSize, ...(diffSummary ? { diffSummary } : {}) } as any),
          },
        });

        let syncResult = null;
        try {
          const driveReady = await verifyCredentials();
          if (driveReady) {
            syncResult = await syncDocumentToDrive(docId, req.user!.id, undefined, { skipNewVersion: true });
          }
        } catch (syncError) {
          console.error('[Save] Auto-sync a Drive falló:', (syncError as Error).message);
          syncResult = { ok: false, error: (syncError as Error).message };
        }

        res.json(serializeBigInt({
          ok: true,
          version: doc.version,
          size: fileSize,
          localPath: req.file.path,
          syncResult,
        }));
      }

      // ── Auto-transición de asignación: pendiente|visto → revisado ──
      // Se ejecuta después de enviar la respuesta (fire-and-forget)
      (async () => {
        try {
          const assignmentsToUpdate = await prisma.documentAssignment.findMany({
            where: {
              documentId: docId,
              assignedTo: req.user!.id,
              status: { in: ['pendiente', 'visto'] },
            },
            select: { id: true, status: true },
          });

          if (assignmentsToUpdate.length === 0) return;

          await prisma.documentAssignment.updateMany({
            where: { id: { in: assignmentsToUpdate.map(a => a.id) } },
            data: { status: 'revisado' },
          });

          await prisma.activityLog.createMany({
            data: assignmentsToUpdate.map(a => ({
              userId: req.user!.id,
              activity: 'COLLABORATION_STARTED',
              entityType: 'document',
              entityId: docId,
              entityName: doc.name,
              description: `Estado automático de asignación: ${a.status === 'pendiente' ? 'Pendiente' : 'Visto'} → Revisado`,
              metadata: {
                assignmentId: a.id,
                fromStatus: a.status,
                toStatus: 'revisado',
                automatic: true,
              },
            })),
          });
        } catch (err) {
          console.error('[Assignment auto-status] Error →revisado:', err);
        }
      })();
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/permissions ──────────────────────────────────────
// Lista todos los permisos del documento
documentsRouter.get(
  '/:id/permissions',
  validateParams(uuidParam),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const permissions = await prisma.documentPermission.findMany({
        where: { documentId: paramId(req) },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          group: { select: { id: true, name: true } },
          granter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      // También incluir el permiso efectivo del usuario que consulta
      const effectivePermission = req.effectivePermission ?? 'none';

      res.json({ permissions, effectivePermission });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/effective-permission ─────────────────────────────
// Devuelve el permiso efectivo del usuario autenticado sobre este documento
documentsRouter.get(
  '/:id/effective-permission',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await getEffectivePermission(req.user!.id, paramId(req));
      res.json({ permission: level });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PUT /api/documents/:id/permissions ──────────────────────────────────────
// Batch upsert — reemplaza todos los permisos del documento
const batchPermissionsSchema = z.object({
  permissions: z.array(z.object({
    userId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    permissionLevel: z.enum(['none', 'download', 'read', 'write', 'admin']),
    expiresAt: z.string().datetime().optional().nullable(),
  })).min(0),
});

documentsRouter.put(
  '/:id/permissions',
  validateParams(uuidParam),
  authorize('admin'),
  requirePermission('admin'),
  validate(batchPermissionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { permissions: incoming } = req.body as z.infer<typeof batchPermissionsSchema>;

      // Transacción: eliminar existentes y crear nuevos
      await prisma.$transaction(async (tx) => {
        // Eliminar todos los permisos actuales
        await tx.documentPermission.deleteMany({ where: { documentId: docId } });

        // Crear los nuevos (filtrar 'none' ya que no se persisten)
        const toCreate = incoming.filter(p => p.permissionLevel !== 'none');
        if (toCreate.length > 0) {
          await tx.documentPermission.createMany({
            data: toCreate.map(p => ({
              documentId: docId,
              userId: p.userId || null,
              groupId: p.groupId || null,
              permissionLevel: p.permissionLevel as any,
              grantedBy: req.user!.id,
              expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
            })),
          });
        }
      });

      // Log de actividad
      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: `Permisos actualizados (${incoming.length} registros)`,
          metadata: { count: incoming.length },
        },
      });

      // Devolver los permisos actualizados
      const updated = await prisma.documentPermission.findMany({
        where: { documentId: docId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          group: { select: { id: true, name: true } },
          granter: { select: { id: true, name: true } },
        },
      });

      res.json({ permissions: updated });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/permissions ─────────────────────────────────────
// Crea un permiso individual
const addPermissionSchema = z.object({
  userId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  permissionLevel: z.enum(['download', 'read', 'write', 'admin']),
  expiresAt: z.string().datetime().optional().nullable(),
});

documentsRouter.post(
  '/:id/permissions',
  validateParams(uuidParam),
  authorize('admin'),
  requirePermission('admin'),
  validate(addPermissionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { userId, groupId, permissionLevel, expiresAt } = req.body;

      if (!userId && !groupId) {
        res.status(400).json({ error: 'Se requiere userId o groupId' });
        return;
      }

      // Upsert: si ya existe un permiso para este user/group, actualizarlo
      const existing = await prisma.documentPermission.findFirst({
        where: {
          documentId: docId,
          ...(userId ? { userId } : { groupId }),
        },
      });

      let permission;
      if (existing) {
        permission = await prisma.documentPermission.update({
          where: { id: existing.id },
          data: {
            permissionLevel: permissionLevel as any,
            grantedBy: req.user!.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            group: { select: { id: true, name: true } },
          },
        });
      } else {
        permission = await prisma.documentPermission.create({
          data: {
            documentId: docId,
            userId: userId || null,
            groupId: groupId || null,
            permissionLevel: permissionLevel as any,
            grantedBy: req.user!.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            group: { select: { id: true, name: true } },
          },
        });
      }

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: `Permiso ${permissionLevel} otorgado`,
        },
      });

      res.status(201).json(permission);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/documents/:id/permissions/:permId ───────────────────────────
// Elimina un permiso específico
documentsRouter.delete(
  '/:id/permissions/:permId',
  validateParams(z.object({ id: z.string().uuid(), permId: z.string().uuid() })),
  authorize('admin'),
  requirePermission('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const permId = Array.isArray(req.params.permId) ? req.params.permId[0] : req.params.permId;

      await prisma.documentPermission.delete({ where: { id: permId } });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: paramId(req),
          description: 'Permiso eliminado',
        },
      });

      res.json({ message: 'Permiso eliminado' });
    } catch (error) {
      next(error);
    }
  },
);
// ─── POST /api/documents/:id/access-pin ─────────────────────────────────────
// Genera un PIN de acceso de un solo uso (solo admin/abogado)
documentsRouter.post(
  '/:id/access-pin',
  validateParams(uuidParam),
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);

      // Verificar que el documento existe
      const doc = await prisma.document.findUnique({ where: { id: docId } });
      if (!doc) {
        res.status(404).json({ error: 'Documento no encontrado' });
        return;
      }

      // Invalidar PINs anteriores no usados de este documento
      await prisma.documentAccessPin.updateMany({
        where: { documentId: docId, isUsed: false },
        data: { isUsed: true },
      });

      // Generar PIN de 6 dígitos
      const pin = String(Math.floor(100000 + Math.random() * 900000));

      // Crear PIN con expiración de 15 minutos
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const accessPin = await prisma.documentAccessPin.create({
        data: {
          documentId: docId,
          pin,
          createdBy: req.user!.id,
          expiresAt,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: 'PIN de acceso generado',
        },
      });

      res.status(201).json({
        pin: accessPin.pin,
        expiresAt: accessPin.expiresAt.toISOString(),
        documentName: doc.name,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/redeem-pin ─────────────────────────────────────
// Canjea un PIN de acceso para obtener permisos de admin en el documento
const redeemPinSchema = z.object({
  pin: z.string().length(6),
});

documentsRouter.post(
  '/:id/redeem-pin',
  validateParams(uuidParam),
  validate(redeemPinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { pin } = req.body;
      const userId = req.user!.id;

      // Buscar PIN válido
      const accessPin = await prisma.documentAccessPin.findFirst({
        where: {
          documentId: docId,
          pin,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!accessPin) {
        res.status(400).json({ error: 'PIN inválido, expirado o ya utilizado' });
        return;
      }

      // Marcar PIN como usado
      await prisma.documentAccessPin.update({
        where: { id: accessPin.id },
        data: {
          isUsed: true,
          usedBy: userId,
          usedAt: new Date(),
        },
      });

      // Otorgar permiso admin al usuario en este documento (upsert)
      const existing = await prisma.documentPermission.findFirst({
        where: { documentId: docId, userId },
      });

      if (existing) {
        await prisma.documentPermission.update({
          where: { id: existing.id },
          data: {
            permissionLevel: 'admin',
            grantedBy: accessPin.createdBy,
          },
        });
      } else {
        await prisma.documentPermission.create({
          data: {
            documentId: docId,
            userId,
            permissionLevel: 'admin',
            grantedBy: accessPin.createdBy,
          },
        });
      }

      await prisma.activityLog.create({
        data: {
          userId,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: 'Acceso completo otorgado via PIN',
        },
      });

      res.json({ message: 'Acceso completo otorgado', permission: 'admin' });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/fix-groups ─────────────────────────────────────────
// Migración: asigna groupId a documentos huérfanos usando el grupo del dueño.
// Solo debe ejecutarse una vez. Requiere autenticación.

documentsRouter.post(
  '/fix-groups',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obtener todos los documentos sin groupId
      const orphanDocs = await prisma.document.findMany({
        where: { groupId: null },
        select: { id: true, ownerId: true },
      });

      if (orphanDocs.length === 0) {
        res.json({ message: 'No hay documentos sin grupo para corregir.', fixed: 0 });
        return;
      }

      // Obtener los grupos de cada owner
      const ownerIds = [...new Set(orphanDocs.map(d => d.ownerId).filter((id): id is string => id !== null))];
      const ownerGroups = await prisma.groupMember.findMany({
        where: { userId: { in: ownerIds } },
        select: { userId: true, groupId: true },
        distinct: ['userId'],
      });

      const ownerGroupMap = new Map<string, string>();
      for (const og of ownerGroups) {
        ownerGroupMap.set(og.userId, og.groupId);
      }

      // Actualizar cada documento huérfano
      let fixed = 0;
      for (const doc of orphanDocs) {
        const groupId = doc.ownerId ? ownerGroupMap.get(doc.ownerId) : undefined;
        if (groupId) {
          await prisma.document.update({
            where: { id: doc.id },
            data: { groupId },
          });
          fixed++;
        }
      }

      res.json({
        message: `${fixed} documentos actualizados con groupId.`,
        fixed,
        total: orphanDocs.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/xlsx-data ────────────────────────────────────────
// Parsea un archivo XLSX y devuelve los datos como JSON (columnas + filas)
documentsRouter.get(
  '/:id/xlsx-data',
  validateParams(uuidParam),
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
        select: { id: true, localPath: true, type: true },
      });

      const t = doc.type?.toUpperCase();
      if (t !== 'XLSX' && t !== 'XLS') {
        res.status(400).json({ error: 'El documento no es un archivo Excel' });
        return;
      }

      if (!doc.localPath) {
        res.status(404).json({ error: 'Archivo no disponible' });
        return;
      }

      const filePath = resolveFilePath(doc.localPath);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Archivo no encontrado en disco' });
        return;
      }

      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        res.json({ columns: [], rows: [], sheetNames: wb.SheetNames });
        return;
      }

      const ws = wb.Sheets[sheetName];
      const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rawData.length === 0) {
        res.json({ columns: [], rows: [], sheetNames: wb.SheetNames });
        return;
      }

      const headerRow = rawData[0];
      const columns = headerRow.map((name: string, idx: number) => ({
        id: `col_${idx}`,
        name: String(name || `Columna ${idx + 1}`),
        type: 'text' as const,
      }));

      const rows = rawData.slice(1).map((row, rowIdx) => {
        const cells: Record<string, string> = {};
        columns.forEach((col, colIdx) => {
          cells[col.id] = String(row[colIdx] ?? '');
        });
        return { id: `row_${rowIdx}`, cells };
      });

      res.json({ columns, rows, sheetNames: wb.SheetNames });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/save-xlsx ───────────────────────────────────────
// Recibe datos de tabla JSON, genera XLSX, lo guarda en disco y actualiza el documento
const saveXlsxSchema = z.object({
  tableData: z.object({
    columns: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string().default('text'),
    })),
    rows: z.array(z.object({
      id: z.string(),
      cells: z.record(z.string(), z.string()),
    })),
  }),
  changeNote: z.string().optional(),
  createVersion: z.boolean().default(false),
});

documentsRouter.post(
  '/:id/save-xlsx',
  validateParams(uuidParam),
  requirePermission('write'),
  validate(saveXlsxSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { tableData, changeNote, createVersion } = req.body;

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: { id: true, name: true, type: true, localPath: true, version: true, ownerId: true },
      });

      const headers = tableData.columns.map((c: any) => c.name);
      const dataRows = tableData.rows.map((row: any) =>
        tableData.columns.map((col: any) => row.cells[col.id] || ''),
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');

      const uploadDir = path.join(process.cwd(), 'uploads');
      await mkdir(uploadDir, { recursive: true });
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filePath = path.join(uploadDir, `${uniqueSuffix}.xlsx`);
      XLSX.writeFile(wb, filePath);

      const fileSize = fs.statSync(filePath).size;

      if (createVersion) {
        const newVersion = doc.version + 1;
        await prisma.$transaction([
          prisma.document.update({
            where: { id: docId },
            data: { localPath: filePath, size: BigInt(fileSize), version: newVersion, updatedAt: new Date() },
          }),
          prisma.documentVersion.create({
            data: {
              documentId: docId, version: newVersion, localPath: filePath,
              size: BigInt(fileSize), changeNote: changeNote || `Tabla guardada v${newVersion}`,
              createdBy: req.user!.id,
            } as any,
          }),
          prisma.activityLog.create({
            data: {
              userId: req.user!.id, activity: 'DOCUMENT_VERSION_CREATED',
              entityType: 'document', entityId: docId, entityName: doc.name,
              description: `Tabla Excel guardada con nueva versión v${newVersion}`,
            },
          }),
        ]);

        let syncResult = null;
        try {
          const driveReady = await verifyCredentials();
          if (driveReady) syncResult = await syncDocumentToDrive(docId, req.user!.id, changeNote, { skipNewVersion: true });
        } catch (e) { syncResult = { ok: false, error: (e as Error).message }; }

        res.json(serializeBigInt({ ok: true, version: newVersion, size: fileSize, syncResult }));
      } else {
        await prisma.document.update({
          where: { id: docId },
          data: { localPath: filePath, size: BigInt(fileSize), updatedAt: new Date() },
        });

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id, activity: 'DOCUMENT_UPDATED',
            entityType: 'document', entityId: docId, entityName: doc.name,
            description: 'Tabla Excel actualizada',
          },
        });

        let syncResult = null;
        try {
          const driveReady = await verifyCredentials();
          if (driveReady) syncResult = await syncDocumentToDrive(docId, req.user!.id, changeNote, { skipNewVersion: true });
        } catch (e) { syncResult = { ok: false, error: (e as Error).message }; }

        res.json(serializeBigInt({ ok: true, version: doc.version, size: fileSize, syncResult }));
      }
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/share ───────────────────────────────────────────
// Registra que el documento fue compartido con un contacto (email, app, etc.)
const shareDocumentSchema = z.object({
  sharedWith: z.string().min(1).max(255), // email, nombre de app, o identificador del contacto
  shareMethod: z.enum(['email', 'whatsapp', 'link', 'system', 'other']).default('system'),
  note: z.string().max(500).optional(),
});

documentsRouter.post(
  '/:id/share',
  validateParams(uuidParam),
  requirePermission('read'),
  validate(shareDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { sharedWith, shareMethod, note } = req.body;

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: { id: true, name: true },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'DOCUMENT_SHARED',
          entityType: 'document',
          entityId: docId,
          entityName: doc.name,
          description: `Documento compartido con: ${sharedWith}`,
          metadata: {
            sharedWith,
            shareMethod,
            note: note || null,
          },
        },
      });

      res.status(201).json({ ok: true, sharedWith, shareMethod });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/shares ───────────────────────────────────────────
// Lista el historial de shares de un documento
documentsRouter.get(
  '/:id/shares',
  validateParams(uuidParam),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);

      const shares = await prisma.activityLog.findMany({
        where: {
          entityId: docId,
          entityType: 'document',
          activity: 'DOCUMENT_SHARED',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Extraer los contactos únicos compartidos
      const sharedContacts = shares.map(s => ({
        id: s.id,
        sharedWith: (s.metadata as any)?.sharedWith || 'Desconocido',
        shareMethod: (s.metadata as any)?.shareMethod || 'system',
        sharedBy: s.user,
        sharedAt: s.createdAt,
      }));

      res.json({ shares: sharedContacts });
    } catch (error) {
      next(error);
    }
  },
);
