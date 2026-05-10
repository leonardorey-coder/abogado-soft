// ============================================================================
// Documents Routes — CRUD, soft-delete, papelera, búsqueda, versiones, upload
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import mammoth from 'mammoth';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requirePermission, getEffectivePermission } from '../middleware/checkPermission.js';
import { requireFirm } from '../middleware/requireFirm.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import { getSearchServiceSync } from '../services/search/SearchServiceFactory.js';
import { extractTextFromFile } from '../services/search/textExtractor.js';

import * as Diff from 'diff';
import * as XLSX from 'xlsx';
import { getStorageProvider, docKey, versionKey, pdfKey, downloadDocumentBuffer } from '../lib/storage/index.js';
import { hasRecentDocumentViewedLog } from '../lib/activityViewLog.js';

let pdfParseLoader: Promise<(data: Buffer) => Promise<any>> | null = null;
async function getPdfParse() {
  if (!pdfParseLoader) {
    pdfParseLoader = (async () => {
      const mod: any = await import('pdf-parse');
      const fn = mod.default ?? mod;
      return fn as (data: Buffer) => Promise<any>;
    })();
  }
  return pdfParseLoader;
}


// ─── Helpers de extracción de texto desde Buffer (sin disco) ───────────────────
// Usados para diff de versiones y para indexación en búsqueda.

async function extractHtmlFromBuffer(buf: Buffer, ext: string): Promise<string> {
  const normalExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

  if (normalExt === '.txt' || normalExt === '.rtf') {
    const raw = buf.toString('utf-8');
    return raw.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  if (normalExt === '.docx' || normalExt === '.doc') {
    try {
      const result = await mammoth.convertToHtml(
        { buffer: buf },
        {
          convertImage: mammoth.images.imgElement(async (image: any) => {
            const imgBuf = await image.read();
            const base64 = Buffer.from(imgBuf).toString('base64');
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
    } catch { return ''; }
  }
  if (normalExt === '.pdf') {
    try {
      const pdfParse = await getPdfParse();
      const data = await pdfParse(buf);
      const raw = data.text || '';
      return raw.split(/\n\n+/).map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    } catch { return ''; }
  }
  return '';
}

async function computeDiffSummaryFromBuffers(oldBuf: Buffer | null, newBuf: Buffer | null, ext: string) {
  try {
    const [oldHtml, newHtml] = await Promise.all([
      oldBuf ? extractHtmlFromBuffer(oldBuf, ext) : Promise.resolve(''),
      newBuf ? extractHtmlFromBuffer(newBuf, ext) : Promise.resolve(''),
    ]);
    if (!oldHtml && !newHtml) return null;
    const diffs = Diff.diffLines(oldHtml.replace(/<[^>]+>/g, ''), newHtml.replace(/<[^>]+>/g, ''));
    let linesAdded = 0, linesRemoved = 0;
    const addedSamples: { type: 'added'; content: string }[] = [];
    const removedSamples: { type: 'removed'; content: string }[] = [];
    for (const part of diffs) {
      const lines = (part.value || '').split('\n').filter((l: string) => l.trim());
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
  } catch { return null; }
}


// ─── Multer: memoryStorage (archivos en RAM, sin disco) ─────────────────────
// para uploads intermedios del editor (archivos <= 50 MB).
// Para archivos más grandes el cliente usa POST /api/drive/upload-url
// y sube directamente a Drive (flujo resumable).

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



const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — archivos grandes usan flujo firmado
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
      'text/plain',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const documentsRouter = Router();
documentsRouter.use(authenticate);
documentsRouter.use(requireFirm);

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
  from: z.string().optional(),
  to: z.string().optional(),
});

// ─── GET /api/documents/recently-opened ────────────────────────────────────
// MUST be defined before /:id so Express doesn't match it as a UUID
documentsRouter.get(
  '/recently-opened',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 30);
      const userId = req.user!.id;
      const userGroup = await prisma.groupMember.findFirst({
        where: { userId },
        select: { groupId: true },
      });
      const userIds: string[] = [userId];

      if (userGroup) {
        const groupMembers = await prisma.groupMember.findMany({
          where: { groupId: userGroup.groupId },
          select: { userId: true },
        });
        for (const member of groupMembers) {
          if (!userIds.includes(member.userId)) userIds.push(member.userId);
        }
      }

      // Get the most recent unique documents/convenios opened (DOCUMENT_VIEWED)
      // using a subquery to deduplicate by entityId keeping the most recent
      const recentLogs = await prisma.activityLog.findMany({
        where: {
          firmId: req.user!.firmId!,
          userId: { in: userIds },
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
          user: { select: { id: true, name: true, avatarUrl: true } },
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
                openedBy: log.user,
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
                openedBy: log.user,
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

// ─── GET /api/documents/recently-shared ─────────────────────────────────────
// Devuelve los archivos/convenios compartidos recientemente (globales del grupo/usuario)
// MUST be defined before /:id so Express doesn't match it as a UUID
documentsRouter.get(
  '/recently-shared',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);
      const userId = req.user!.id;

      // Obtener el grupo del usuario para ver shares del equipo completo
      const userGroup = await prisma.groupMember.findFirst({
        where: { userId },
        select: { groupId: true },
      });

      // Buscar shares de documentos y convenios
      // Si el usuario es parte de un grupo, ver los del equipo
      // Si no, solo los propios
      const userIds: string[] = [userId];
      if (userGroup) {
        const groupMembers = await prisma.groupMember.findMany({
          where: { groupId: userGroup.groupId },
          select: { userId: true },
        });
        for (const m of groupMembers) {
          if (!userIds.includes(m.userId)) userIds.push(m.userId);
        }
      }

      const shareLogs = await prisma.activityLog.findMany({
        where: {
          OR: [
            { firmId: req.user!.firmId },
            { firmId: null, userId: { in: userIds } },
          ],
          activity: 'DOCUMENT_SHARED',
          entityId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 3,
        select: {
          id: true,
          entityId: true,
          entityType: true,
          entityName: true,
          createdAt: true,
          metadata: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Agrupar por (entityId) manteniendo todas las entradas (no deduplicar por entidad,
      // ya que queremos ver todos los shares), pero limitar al total solicitado.
      const results: any[] = [];
      const seenLogIds = new Set<string>();

      for (const log of shareLogs) {
        if (seenLogIds.has(log.id) || !log.entityId) continue;
        seenLogIds.add(log.id);

        const meta = (log.metadata as any) ?? {};

        const entry: any = {
          logId: log.id,
          entityId: log.entityId,
          entityType: log.entityType || 'document',
          entityName: log.entityName || 'Sin nombre',
          sharedWith: meta.sharedWith || 'Desconocido',
          shareMethod: (meta.shareMethod as string) || 'system',
          note: meta.note || null,
          sharedAt: log.createdAt,
          sharedBy: log.user,
        };

        // Enriquecer con datos actuales de la entidad (nombre, tipo, estado)
        try {
          if (entry.entityType === 'document') {
            const doc = await prisma.document.findUnique({
              where: { id: log.entityId, isDeleted: false },
              select: { id: true, name: true, type: true, fileStatus: true },
            });
            if (doc) {
              entry.entityName = doc.name;
              entry.entitySubtype = doc.type;
              entry.entityStatus = doc.fileStatus;
            }
          } else if (entry.entityType === 'convenio') {
            const conv = await prisma.convenio.findUnique({
              where: { id: log.entityId },
              select: { id: true, numero: true, institucion: true, estado: true },
            });
            if (conv) {
              entry.entityName = `${conv.numero} – ${conv.institucion}`;
              entry.entitySubtype = 'CONVENIO';
              entry.entityStatus = conv.estado;
            }
          }
        } catch {
          // Entidad eliminada — igualmente incluir el log
        }

        results.push(entry);
        if (results.length >= limit) break;
      }

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  },
);

const setDocumentPinBodySchema = z.object({
  pinned: z.boolean(),
});

// ─── GET /api/documents/pinned ──────────────────────────────────────────────
// Pins por usuario (solo req.user.id; no incluir actividad de otros del grupo)
documentsRouter.get(
  '/pinned',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        res.json({ data: [] });
        return;
      }

      const pins = await prisma.userDocumentPin.findMany({
        where: {
          userId: req.user!.id,
          document: {
            firmId,
            isDeleted: false,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          documentId: true,
          createdAt: true,
        },
      });

      const filtered: { documentId: string; pinnedAt: string }[] = [];
      for (const row of pins) {
        const level = await getEffectivePermission(req.user!.id, row.documentId);
        if (level === 'none') continue;
        filtered.push({
          documentId: row.documentId,
          pinnedAt: row.createdAt.toISOString(),
        });
      }

      res.json({ data: filtered });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PUT /api/documents/:id/pin ──────────────────────────────────────────────
documentsRouter.put(
  '/:id/pin',
  validateParams(uuidParam),
  validate(setDocumentPinBodySchema),
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const { pinned } = req.body as z.infer<typeof setDocumentPinBodySchema>;
      const firmId = req.user!.firmId;
      if (!firmId) {
        res.status(403).json({ error: 'Sin despacho asignado' });
        return;
      }

      const doc = await prisma.document.findFirst({
        where: { id: docId, firmId, isDeleted: false },
        select: { id: true },
      });
      if (!doc) {
        res.status(404).json({ error: 'Documento no encontrado' });
        return;
      }

      if (pinned) {
        await prisma.userDocumentPin.upsert({
          where: {
            userId_documentId: {
              userId: req.user!.id,
              documentId: docId,
            },
          },
          create: {
            userId: req.user!.id,
            documentId: docId,
          },
          update: {},
        });
      } else {
        await prisma.userDocumentPin.deleteMany({
          where: { userId: req.user!.id, documentId: docId },
        });
      }

      res.json({ ok: true, documentId: docId, pinned });
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

      const firmId = req.user!.firmId!;
      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: { isDeleted: true, firmId, ownerId: req.user!.id },
          skip,
          take: limit,
          orderBy: { deletedAt: 'desc' },
          include: {
            deleter: { select: { id: true, name: true } },
          },
        }),
        prisma.document.count({ where: { isDeleted: true, firmId, ownerId: req.user!.id } }),
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
      const { page, limit, sortOrder, search, type, status, groupId, caseId, includeDeleted, from, to } = req.query as any;
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
        firmId: req.user!.firmId!,
        isDeleted: includeDeleted ? undefined : false,
        // Si es admin global, puede ver todo; si no, aplicar filtros de acceso
        ...(isGlobalAdmin ? {} : { OR: accessConditions }),
      };

      if (search) where.name = { contains: search, mode: 'insensitive' };
      if (type) where.type = type;
      if (status) where.fileStatus = status;
      if (groupId) where.groupId = groupId;
      if (caseId) where.caseId = caseId;
      if (from || to) {
        where.updatedAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }

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

      res.json({ data: serializeBigInt(documentsWithShares), total, page, limit });
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

          const alreadyLogged = await hasRecentDocumentViewedLog({
            userId: req.user!.id,
            entityType: 'document',
            entityId: docId,
          });
          if (!alreadyLogged) {
            await prisma.activityLog.create({
              data: {
                firmId: req.user!.firmId ?? null,
                userId: req.user!.id,
                activity: 'DOCUMENT_VIEWED',
                entityType: 'document',
                entityId: docId,
                entityName: document.name,
                description: `Documento abierto: ${document.name}`,
              },
            });
          }

          // Auto-transición de asignación: pendiente → visto
          const pendingAssignments = await prisma.documentAssignment.findMany({
            where: {
              documentId: docId,
              assignedTo: req.user!.id,
              status: 'pendiente',
            },
            select: { id: true, assignedBy: true },
          });

          if (pendingAssignments.length === 0) return;

          const transition = await prisma.documentAssignment.updateMany({
            where: { id: { in: pendingAssignments.map(a => a.id) } },
            data: { status: 'visto' },
          });

          if (transition.count <= 0) return;

          const firstAssignment = pendingAssignments[0];
          await prisma.activityLog.create({
            data: {
              firmId: req.user!.firmId ?? null,
              userId: req.user!.id,
              activity: 'DOCUMENT_WORKFLOW_STATUS_CHANGED',
              entityType: 'document',
              entityId: docId,
              entityName: document.name,
              description: 'Estado automático de asignación: Pendiente → Visto',
              metadata: {
                assignmentId: firstAssignment?.id,
                field: 'assignmentStatus',
                from: 'pendiente',
                to: 'visto',
                automatic: true,
                transitionCount: transition.count,
                assignedById: firstAssignment?.assignedBy ?? null,
                assignedToId: req.user!.id,
              },
            },
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
// Recibe el archivo en memoryStorage, lo sube directamente a Google Drive.
// No escribe ningún byte en el disco del servidor.
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

      // Determinar tipo de documento desde extensión
      const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
      const typeMap: Record<string, string> = {
        doc: 'doc', docx: 'docx', pdf: 'pdf',
        xls: 'xls', xlsx: 'xlsx', txt: 'txt', rtf: 'rtf',
        jpg: 'pdf', jpeg: 'pdf', png: 'pdf', gif: 'pdf', webp: 'pdf',
      };
      const docType = typeMap[ext] ?? 'pdf';

      // Obtener grupo por defecto
      let defaultGroupId = req.body.groupId;
      if (!defaultGroupId) {
        const userGroup = await prisma.groupMember.findFirst({
          where: { userId: req.user!.id },
          select: { groupId: true },
        });
        if (userGroup) defaultGroupId = userGroup.groupId;
      }

      // Crear registro en BD (sin localPath)
      const document = await prisma.document.create({
        data: {
          name: req.body.name || file.originalname,
          type: docType as any,
          size: BigInt(file.size),
          mimeType: file.mimetype,
          ownerId: req.user!.id,
          description: req.body.description || undefined,
          groupId: defaultGroupId || undefined,
          caseId: req.body.caseId || undefined,
          tags: req.body.tags ? JSON.parse(req.body.tags) : [],
          firmId: req.user!.firmId || undefined,
        },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId || undefined,
          userId: req.user!.id,
          activity: 'DOCUMENT_CREATED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Archivo subido: ${document.name} (${(file.size / 1024).toFixed(1)} KB)`,
        },
      });

      // Subir buffer a R2
      let syncResult = null;
      try {
        const storage = getStorageProvider();
        const key = docKey(document.firmId, document.groupId, document.id, ext);
        await storage.upload(key, file.buffer, file.mimetype);
        await prisma.document.update({
          where: { id: document.id },
          data: { storageKey: key, syncStatus: 'completed', lastSyncAt: new Date() },
        });
        syncResult = { ok: true };
      } catch (syncError) {
        console.error('[Upload] Auto-sync a R2 falló:', (syncError as Error).message);
        await prisma.document.update({ where: { id: document.id }, data: { syncStatus: 'failed' } });
        syncResult = { ok: false, error: (syncError as Error).message };
      }

      const freshDocument = await prisma.document.findUniqueOrThrow({
        where: { id: document.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      res.status(201).json(serializeBigInt({ ...freshDocument, syncResult }));

      // Fire-and-forget: indexar en búsqueda usando el buffer en memoria
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (!svc) return;
          const textContent = (await extractHtmlFromBuffer(file.buffer, ext)).replace(/<[^>]+>/g, ' ').trim();
          await svc.indexDocument({
            id: freshDocument.id,
            entityType: 'document',
            title: freshDocument.name,
            subtitle: freshDocument.description ?? undefined,
            tags: freshDocument.tags ?? [],
            textContent,
            url: `/documento/${freshDocument.id}`,
            meta: { type: freshDocument.type, fileStatus: freshDocument.fileStatus },
            createdAt: freshDocument.createdAt.toISOString(),
            updatedAt: freshDocument.updatedAt.toISOString(),
          });
        } catch (err) {
          console.warn('[Search] Error indexando documento subido:', (err as Error).message);
        }
      })();

    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/file ────────────────────────────────────────────
// Sirve el archivo raw como proxy de Drive (preview/embeddings).
// No escribe en disco: descarga de Drive y hace pipe al cliente.
documentsRouter.get(
  '/:id/file',
  validateParams(uuidParam),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
        select: { type: true, mimeType: true, storageKey: true, driveFileId: true, localPath: true },
      });

      // Soporte para preview de versión específica via ?version=N
      const versionQuery = req.query.version;
      let fileSource: { storageKey?: string | null; driveFileId?: string | null; localPath?: string | null } = doc;
      if (versionQuery) {
        const ver = await prisma.documentVersion.findFirst({
          where: { documentId: paramId(req), version: parseInt(versionQuery as string, 10) },
          select: { storageKey: true, cloudUrl: true, localPath: true },
        });
        if (ver) fileSource = { storageKey: ver.storageKey, driveFileId: ver.cloudUrl, localPath: ver.localPath };
      }

      if (!fileSource.storageKey && !fileSource.driveFileId && !fileSource.localPath) {
        res.status(404).json({ error: 'Archivo no disponible' });
        return;
      }

      const buffer = await downloadDocumentBuffer(fileSource);
      if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
      res.send(buffer);
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
        include: { document: { select: { mimeType: true, name: true } } },
      });

      const mimeType = version.document.mimeType ?? 'application/octet-stream';
      const buffer = await downloadDocumentBuffer({
        storageKey: version.storageKey,
        driveFileId: version.cloudUrl,
        localPath: version.localPath,
      });
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(version.document.name)}"`);
      res.send(buffer);
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
        select: { name: true, mimeType: true, storageKey: true, driveFileId: true, localPath: true },
      });

      if (!doc.storageKey && !doc.driveFileId && !doc.localPath) {
        res.status(404).json({ error: 'Archivo no disponible para descarga' });
        return;
      }

      const buffer = await downloadDocumentBuffer(doc);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}"`);
      if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/content ──────────────────────────────────────────
// Extrae HTML del archivo descargando el buffer desde Drive.
// DOCX → HTML vía mammoth, TXT → párrafos, otros formatos → 404.
documentsRouter.get(
  '/:id/content',
  validateParams(uuidParam),
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: paramId(req) },
        select: { type: true, storageKey: true, driveFileId: true, localPath: true },
      });

      if (!doc.storageKey && !doc.driveFileId && !doc.localPath) {
        res.json({ html: '' });
        return;
      }

      const buffer = await downloadDocumentBuffer(doc);
      const ext = `.${doc.type.toLowerCase()}`;
      const html = await extractHtmlFromBuffer(buffer, ext);

      if (ext === '.docx' || ext === '.doc' || ext === '.txt' || ext === '.rtf') {
        res.json({ html });
        return;
      }

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
          firmId: req.user!.firmId!,
          ownerId: req.user!.id,
          groupId: defaultGroupId || undefined,
          size: BigInt(data.size),
          expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_CREATED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento creado: ${document.name}`,
        },
      });

      res.status(201).json(serializeBigInt(document));

      // ── Fire-and-forget: indexar en búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (!svc) return;
          const textContent = await extractTextFromFile((document as any).localPath);
          await svc.indexDocument({
            id: document.id,
            entityType: 'document',
            title: document.name,
            subtitle: (document as any).description ?? undefined,
            tags: (document as any).tags ?? [],
            textContent,
            url: `/documento/${document.id}`,
            meta: { type: document.type, fileStatus: document.fileStatus },
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
          });
        } catch (err) {
          console.warn('[Search] Error indexando documento creado:', (err as Error).message);
        }
      })();
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
      const id = paramId(req);
      const body = req.body as Record<string, unknown>;
      const previous = await prisma.document.findUniqueOrThrow({ where: { id } });

      const document = await prisma.document.update({
        where: { id },
        data: body,
      });

      if (previous.fileStatus !== document.fileStatus) {
        await prisma.activityLog.create({
          data: {
            firmId: req.user!.firmId ?? null,
            userId: req.user!.id,
            activity: 'DOCUMENT_FILE_STATUS_CHANGED',
            entityType: 'document',
            entityId: document.id,
            entityName: document.name,
            description: `Estado de archivo: ${previous.fileStatus} → ${document.fileStatus}`,
            metadata: {
              kind: 'fileStatus',
              fromStatus: previous.fileStatus,
              toStatus: document.fileStatus,
            },
          },
        });
      }

      if (previous.collaborationStatus !== document.collaborationStatus) {
        await prisma.activityLog.create({
          data: {
            firmId: req.user!.firmId ?? null,
            userId: req.user!.id,
            activity: 'DOCUMENT_WORKFLOW_STATUS_CHANGED',
            entityType: 'document',
            entityId: document.id,
            entityName: document.name,
            description: `Colaboración: ${String(previous.collaborationStatus ?? '—')} → ${String(document.collaborationStatus ?? '—')}`,
            metadata: {
              kind: 'workflow',
              field: 'collaborationStatus',
              from: previous.collaborationStatus ?? null,
              to: document.collaborationStatus ?? null,
            },
          },
        });
      }

      if (previous.sharingStatus !== document.sharingStatus) {
        await prisma.activityLog.create({
          data: {
            firmId: req.user!.firmId ?? null,
            userId: req.user!.id,
            activity: 'DOCUMENT_WORKFLOW_STATUS_CHANGED',
            entityType: 'document',
            entityId: document.id,
            entityName: document.name,
            description: `Compartir: ${String(previous.sharingStatus ?? '—')} → ${String(document.sharingStatus ?? '—')}`,
            metadata: {
              kind: 'workflow',
              field: 'sharingStatus',
              from: previous.sharingStatus ?? null,
              to: document.sharingStatus ?? null,
            },
          },
        });
      }

      const statusFieldKeys = new Set(['fileStatus', 'collaborationStatus', 'sharingStatus']);
      const otherKeys = Object.keys(body).filter((k) => !statusFieldKeys.has(k));
      if (otherKeys.length > 0) {
        await prisma.activityLog.create({
          data: {
            firmId: req.user!.firmId ?? null,
            userId: req.user!.id,
            activity: 'DOCUMENT_UPDATED',
            entityType: 'document',
            entityId: document.id,
            entityName: document.name,
            description: `Datos del documento actualizados: ${document.name}`,
            metadata: { fields: otherKeys },
          },
        });
      }

      res.json(serializeBigInt(document));

      // ── Fire-and-forget: re-indexar en búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (!svc) return;
          const textContent = await extractTextFromFile((document as any).localPath);
          await svc.indexDocument({
            id: document.id,
            entityType: 'document',
            title: document.name,
            subtitle: (document as any).description ?? undefined,
            tags: (document as any).tags ?? [],
            textContent,
            url: `/documento/${document.id}`,
            meta: { type: document.type, fileStatus: document.fileStatus },
            createdAt: (document as any).createdAt?.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
          });
        } catch (err) {
          console.warn('[Search] Error re-indexando documento actualizado:', (err as Error).message);
        }
      })();
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
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_DELETED',
          entityType: 'document',
          entityId: document.id,
          entityName: document.name,
          description: `Documento enviado a papelera: ${document.name}`,
        },
      });

      res.json({ message: 'Documento enviado a papelera' });

      // ── Fire-and-forget: eliminar del índice de búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (svc) await svc.removeDocument(document.id, 'document');
        } catch (err) {
          console.warn('[Search] Error eliminando documento del índice:', (err as Error).message);
        }
      })();
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

      // Recopilar claves de storage ANTES de borrar en BD
      const versionsToDelete = await prisma.documentVersion.findMany({
        where: { documentId: doc.id },
        select: { storageKey: true, cloudUrl: true },
      });
      const pdfsToDelete = await (prisma as any).documentPdf.findMany({
        where: { documentId: doc.id },
        select: { storageKey: true, driveFileId: true },
      });

      // Borrar desde storage (best-effort, sin bloquear la eliminación en BD)
      const storage = getStorageProvider();
      const { deleteFile } = await import('../lib/googleDrive.js');
      for (const v of versionsToDelete) {
        if (v.storageKey) storage.delete(v.storageKey).catch(() => {});
        if (v.cloudUrl) deleteFile(v.cloudUrl).catch(() => {});
      }
      for (const p of pdfsToDelete) {
        if ((p as any).storageKey) storage.delete((p as any).storageKey).catch(() => {});
        if ((p as any).driveFileId) deleteFile((p as any).driveFileId).catch(() => {});
      }
      if (doc.storageKey) storage.delete(doc.storageKey).catch(() => {});
      if (doc.driveFileId) deleteFile(doc.driveFileId).catch(() => {});

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
          firmId: req.user!.firmId ?? null,
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
          firmId: req.user!.firmId ?? null,
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
      const documentId = paramId(req);
      const docMeta = await prisma.document.findUnique({
        where: { id: documentId },
        select: { name: true },
      });
      if (!docMeta) {
        res.status(404).json({ error: 'Documento no encontrado' });
        return;
      }

      const comment = await prisma.documentComment.create({
        data: {
          documentId,
          userId: req.user!.id,
          ...req.body,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_COMMENT_ADDED',
          entityType: 'document',
          entityId: documentId,
          entityName: docMeta.name,
          description: `Comentario en: ${docMeta.name}`,
          metadata: {
            commentId: comment.id,
            commentContent: req.body.content,
            parentCommentId: req.body.parentId ?? null,
          },
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/diff ─────────────────────────────────────────────
// Descarga buffers de Drive para comparar dos versiones.
// @ts-ignore — no types available for htmldiff-js
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

      const fetchBuf = async (ver: any): Promise<Buffer | null> => {
        if (!ver) return null;
        try {
          return await downloadDocumentBuffer({
            storageKey: ver.storageKey,
            driveFileId: ver.cloudUrl,
            localPath: ver.localPath,
          });
        } catch { return null; }
      };

      const doc = await prisma.document.findUnique({
        where: { id: paramId(req) },
        select: { type: true },
      });
      const ext = doc?.type ?? 'docx';

      const [buf1, buf2] = await Promise.all([fetchBuf(ver1), fetchBuf(ver2)]);
      const [html1, html2] = await Promise.all([
        buf1 ? extractHtmlFromBuffer(buf1, ext) : Promise.resolve(''),
        buf2 ? extractHtmlFromBuffer(buf2, ext) : Promise.resolve(''),
      ]);

      const diffHtml = HtmlDiff.execute(html1, html2);
      res.json({ html: diffHtml });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/documents/:id/save ────────────────────────────────────────────
// Recibe el archivo del editor (en RAM via memoryStorage), lo sube a Drive.
// Si el doc aún no tiene driveFileId (primer Guardar), crea el archivo en Drive.
// Si createVersion=true, incrementa la versión en BD.

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
          id: true, name: true, type: true, groupId: true, firmId: true,
          version: true, storageKey: true, driveFileId: true, localPath: true, ownerId: true,
        },
      });

      // 2. Validar que llegó el archivo
      if (!req.file) {
        res.status(400).json({ error: 'No se recibió ningún archivo.' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileSize = req.file.size;

      // 3. Obtener buffer de la versión anterior para diff
      let oldBuffer: Buffer | null = null;
      if (doc.storageKey || doc.driveFileId || doc.localPath) {
        try { oldBuffer = await downloadDocumentBuffer(doc); } catch { /* no diff available */ }
      }

      if (createVersion) {
        // ── Modo "Nueva Versión" ──────────────────────────────────────────────
        //
        // FLUJO CORRECTO:
        //   · La versión previa (doc.version) ya tiene su snapshot actualizado
        //     gracias a que los overwrites mantienen el snapshot en sincronía.
        //   · Se crea el snapshot de la NUEVA versión con el NUEVO contenido.
        //   · El archivo principal también se actualiza con el NUEVO contenido.
        //
        const newVersion = doc.version + 1;
        const diffSummary = await computeDiffSummaryFromBuffers(oldBuffer, fileBuffer, doc.type);

        const dKey = docKey(doc.firmId, doc.groupId, doc.id, doc.type);
        const currentVKey = versionKey(doc.firmId, doc.groupId, doc.id, doc.version, doc.type);
        // Key para el snapshot de la NUEVA versión (contiene el nuevo contenido)
        const newVKey = versionKey(doc.firmId, doc.groupId, doc.id, newVersion, doc.type);
        const currentVersionRecord = await prisma.documentVersion.findFirst({
          where: { documentId: docId, version: doc.version },
          select: { storageKey: true },
        });
        let currentVersionSnapshotKey: string | undefined;

        let syncResult: { ok: boolean; error?: string } | null = null;
        try {
          const storage = getStorageProvider();
          if (oldBuffer && !currentVersionRecord?.storageKey) {
            try {
              await storage.upload(currentVKey, oldBuffer, req.file!.mimetype);
              currentVersionSnapshotKey = currentVKey;
            } catch {
              try {
                await storage.update(currentVKey, oldBuffer, req.file!.mimetype);
                currentVersionSnapshotKey = currentVKey;
              } catch { /* best effort */ }
            }
          }
          // 1. Subir el nuevo contenido como snapshot de la nueva versión
          await storage.upload(newVKey, fileBuffer, req.file!.mimetype);
          // 2. Actualizar el archivo principal con el nuevo contenido
          await storage.update(dKey, fileBuffer, req.file!.mimetype);
          syncResult = { ok: true };
        } catch (syncError) {
          console.error('[Save] Error al subir a R2:', (syncError as Error).message);
          getStorageProvider().delete(newVKey).catch(() => {});
          syncResult = { ok: false, error: (syncError as Error).message };
        }

        const dbOps: any[] = [
          prisma.document.update({
            where: { id: docId },
            data: {
              size: BigInt(fileSize),
              version: newVersion,
              storageKey: dKey,
              syncStatus: syncResult?.ok ? 'completed' : 'failed',
              lastSyncAt: syncResult?.ok ? new Date() : undefined,
              updatedAt: new Date(),
            },
          }),
          prisma.documentVersion.create({
            data: {
              documentId: docId,
              version: newVersion,
              size: BigInt(fileSize),
              changeNote,
              createdBy: req.user!.id,
              // El snapshot de la nueva versión contiene el NUEVO contenido
              storageKey: syncResult?.ok ? newVKey : undefined,
            } as any,
          }),
          prisma.activityLog.create({
            data: {
              firmId: req.user!.firmId ?? null,
              userId: req.user!.id,
              activity: 'DOCUMENT_VERSION_CREATED',
              entityType: 'document',
              entityId: docId,
              entityName: doc.name,
              description: `Nueva versión ${newVersion} guardada${changeNote ? `: ${changeNote}` : ''}`,
              metadata: diffSummary ? ({ diffSummary } as any) : undefined,
            },
          }),
        ];

        if (oldBuffer && currentVersionSnapshotKey) {
          dbOps.unshift(
            prisma.documentVersion.upsert({
              where: { documentId_version: { documentId: docId, version: doc.version } },
              update: {
                size: BigInt(oldBuffer.length),
                storageKey: currentVersionSnapshotKey,
              },
              create: {
                documentId: docId,
                version: doc.version,
                size: BigInt(oldBuffer.length),
                createdBy: doc.ownerId,
                storageKey: currentVersionSnapshotKey,
              } as any,
            })
          );
        }

        await prisma.$transaction(dbOps);

        res.json(serializeBigInt({
          ok: true, version: newVersion, size: fileSize, syncResult,
        }));

      } else {
        // ── Modo "Guardar" (sobreescribir current) ─────────────────────────────
        //
        // CRÍTICO: Actualizar TANTO el archivo principal COMO el snapshot de la
        // versión actual en R2. Si solo actualizamos el principal, la próxima vez
        // que se cree una versión nueva, el snapshot de esta versión quedará stale
        // y al volver a ella se mostrará contenido antiguo.
        //
        const diffSummary = await computeDiffSummaryFromBuffers(oldBuffer, fileBuffer, doc.type);
        const dKey = docKey(doc.firmId, doc.groupId, doc.id, doc.type);
        // Key del snapshot para la versión ACTUAL (se mantiene sincronizada en cada overwrite)
        const currentVKey = versionKey(doc.firmId, doc.groupId, doc.id, doc.version, doc.type);

        let syncResult: { ok: boolean; error?: string } | null = null;
        try {
          const storage = getStorageProvider();

          // 1. Actualizar el archivo principal
          await storage.update(dKey, fileBuffer, req.file!.mimetype);

          // 2. Actualizar también el snapshot de la versión actual
          //    Usamos upload (crea si no existe) con fallback a update.
          try {
            await storage.upload(currentVKey, fileBuffer, req.file!.mimetype);
          } catch {
            try { await storage.update(currentVKey, fileBuffer, req.file!.mimetype); } catch { /* best effort */ }
          }

          syncResult = { ok: true };
        } catch (syncError) {
          console.error('[Save] Error al subir a R2:', (syncError as Error).message);
          syncResult = { ok: false, error: (syncError as Error).message };
        }

        // Buscar el registro de la versión actual para actualizar su storageKey y tamaño
        const currentVersionRecord = await prisma.documentVersion.findFirst({
          where: { documentId: docId, version: doc.version },
          select: { id: true },
        });

        const dbOps: any[] = [
          prisma.document.update({
            where: { id: docId },
            data: {
              size: BigInt(fileSize),
              storageKey: dKey,
              syncStatus: syncResult?.ok ? 'completed' : 'failed',
              lastSyncAt: syncResult?.ok ? new Date() : undefined,
              updatedAt: new Date(),
            },
          }),
          prisma.activityLog.create({
            data: {
              firmId: req.user!.firmId ?? null,
              userId: req.user!.id,
              activity: 'DOCUMENT_UPDATED',
              entityType: 'document',
              entityId: docId,
              entityName: doc.name,
              description: `Documento editado: ${doc.name}`,
              metadata: ({ source: 'editor_save', createVersion: false, size: fileSize, ...(diffSummary ? { diffSummary } : {}) } as any),
            },
          }),
        ];

        // Si existe el registro de la versión actual, actualizar su snapshot y tamaño
        if (currentVersionRecord) {
          dbOps.push(
            prisma.documentVersion.update({
              where: { id: currentVersionRecord.id },
              data: {
                size: BigInt(fileSize),
                storageKey: syncResult?.ok ? currentVKey : undefined,
              },
            })
          );
        }

        await prisma.$transaction(dbOps);

        res.json(serializeBigInt({
          ok: true, version: doc.version, size: fileSize, syncResult,
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
            select: { id: true, status: true, assignedBy: true },
          });

          if (assignmentsToUpdate.length === 0) return;

          await prisma.documentAssignment.updateMany({
            where: { id: { in: assignmentsToUpdate.map(a => a.id) } },
            data: { status: 'revisado' },
          });

          const first = assignmentsToUpdate[0];
          await prisma.activityLog.create({
            data: {
              firmId: req.user!.firmId ?? null,
              userId: req.user!.id,
              activity: 'DOCUMENT_WORKFLOW_STATUS_CHANGED',
              entityType: 'document',
              entityId: docId,
              entityName: doc.name,
              description: `Estado automático de asignación: ${first?.status === 'pendiente' ? 'Pendiente' : 'Visto'} → Revisado`,
              metadata: {
                assignmentId: first?.id,
                field: 'assignmentStatus',
                from: first?.status ?? null,
                to: 'revisado',
                fromStatus: first?.status ?? null,
                toStatus: 'revisado',
                automatic: true,
                transitionCount: assignmentsToUpdate.length,
                assignedById: first?.assignedBy ?? null,
                assignedToId: req.user!.id,
              },
            },
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
      const detailItems = incoming.map((p) => ({
        permissionLevel: p.permissionLevel,
        userId: p.userId ?? null,
        groupId: p.groupId ?? null,
        expiresAt: p.expiresAt ?? null,
      }));
      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: `Permisos actualizados (${incoming.length} registros)`,
          metadata: {
            count: incoming.length,
            action: 'batch_replace',
            details: detailItems,
          },
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
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: docId,
          description: `Permiso ${permissionLevel} otorgado`,
          metadata: {
            action: existing ? 'updated' : 'granted',
            permissionLevel,
            targetUserId: userId ?? null,
            targetGroupId: groupId ?? null,
            targetName: (permission as any)?.user?.name ?? (permission as any)?.group?.name ?? null,
            expiresAt: expiresAt ?? null,
          },
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
      const existingPermission = await prisma.documentPermission.findUnique({
        where: { id: permId },
        include: {
          user: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      });

      await prisma.documentPermission.delete({ where: { id: permId } });

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_PERMISSION_CHANGED',
          entityType: 'document',
          entityId: paramId(req),
          description: 'Permiso eliminado',
          metadata: {
            action: 'removed',
            permissionLevel: existingPermission?.permissionLevel ?? null,
            targetUserId: existingPermission?.userId ?? null,
            targetGroupId: existingPermission?.groupId ?? null,
            targetName: existingPermission?.user?.name ?? existingPermission?.group?.name ?? null,
          },
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
          firmId: req.user!.firmId ?? null,
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
          firmId: req.user!.firmId ?? null,
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
        select: { id: true, type: true, storageKey: true, driveFileId: true, localPath: true },
      });

      const t = doc.type?.toUpperCase();
      if (t !== 'XLSX' && t !== 'XLS') {
        res.status(400).json({ error: 'El documento no es un archivo Excel' });
        return;
      }

      if (!doc.storageKey && !doc.driveFileId && !doc.localPath) {
        res.status(404).json({ error: 'Archivo Excel no disponible' });
        return;
      }

      const xlsxBuffer = await downloadDocumentBuffer(doc);
      const wb = XLSX.read(xlsxBuffer);
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
        select: { id: true, name: true, type: true, groupId: true, firmId: true, storageKey: true, driveFileId: true, localPath: true, version: true, ownerId: true },
      });

      const headers = tableData.columns.map((c: any) => c.name);
      const dataRows = tableData.rows.map((row: any) =>
        tableData.columns.map((col: any) => row.cells[col.id] || ''),
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');

      // Generar XLSX como buffer en memoria
      const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const fileSize = xlsxBuf.byteLength;

      if (createVersion) {
        const newVersion = doc.version + 1;
        await prisma.$transaction([
          prisma.document.update({
            where: { id: docId },
            data: { size: BigInt(fileSize), version: newVersion, updatedAt: new Date() },
          }),
          prisma.documentVersion.create({
            data: {
              documentId: docId, version: newVersion,
              size: BigInt(fileSize), changeNote: changeNote || `Tabla guardada v${newVersion}`,
              createdBy: req.user!.id,
            } as any,
          }),
          prisma.activityLog.create({
            data: {
              firmId: req.user!.firmId ?? null,
              userId: req.user!.id, activity: 'DOCUMENT_VERSION_CREATED',
              entityType: 'document', entityId: docId, entityName: doc.name,
              description: `Tabla Excel guardada con nueva versión v${newVersion}`,
            },
          }),
        ]);

        let syncResult = null;
        const dKey = docKey(doc.firmId, doc.groupId, doc.id, doc.type);
        const vKey = versionKey(doc.firmId, doc.groupId, doc.id, newVersion, doc.type);
        try {
          const storage = getStorageProvider();
          if (doc.storageKey) await storage.copy(doc.storageKey, vKey);
          else await storage.upload(vKey, xlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          await storage.update(dKey, xlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          await prisma.document.update({ where: { id: docId }, data: { storageKey: dKey, syncStatus: 'completed', lastSyncAt: new Date() } });
          await prisma.documentVersion.updateMany({ where: { documentId: docId, version: newVersion }, data: { storageKey: vKey } as any });
          syncResult = { ok: true };
        } catch (e) {
          await prisma.document.update({ where: { id: docId }, data: { syncStatus: 'failed' } });
          syncResult = { ok: false, error: (e as Error).message };
        }

        res.json(serializeBigInt({ ok: true, version: newVersion, size: fileSize, syncResult }));
      } else {
        await prisma.document.update({
          where: { id: docId },
          data: { size: BigInt(fileSize), updatedAt: new Date() },
        });

        await prisma.activityLog.create({
          data: {
            firmId: req.user!.firmId ?? null,
            userId: req.user!.id, activity: 'DOCUMENT_UPDATED',
            entityType: 'document', entityId: docId, entityName: doc.name,
            description: 'Tabla Excel actualizada',
          },
        });

        let syncResult = null;
        try {
          const storage = getStorageProvider();
          const dKey = docKey(doc.firmId, doc.groupId, doc.id, doc.type);
          await storage.update(dKey, xlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          await prisma.document.update({ where: { id: docId }, data: { storageKey: dKey, syncStatus: 'completed', lastSyncAt: new Date() } });
          syncResult = { ok: true };
        } catch (e) {
          await prisma.document.update({ where: { id: docId }, data: { syncStatus: 'failed' } });
          syncResult = { ok: false, error: (e as Error).message };
        }

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
          firmId: req.user!.firmId ?? null,
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
            detailText: `${sharedWith} (${shareMethod})${note ? ` — ${note}` : ''}`,
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

// ─── POST /api/documents/:id/upload-pdf ─────────────────────────────────────
// Recibe un PDF en RAM y lo sube a Drive (pdfUpload ahora usa memoryStorage).
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
});

documentsRouter.post(
  '/:id/upload-pdf',
  validateParams(uuidParam),
  requirePermission('read'),
  pdfUpload.single('pdf'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);
      const source: string = (req.body?.source === 'share') ? 'share' : 'manual';

      if (!req.file) {
        res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
        return;
      }

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: { id: true, name: true, type: true, groupId: true, firmId: true },
      });

      const baseName = doc.name.replace(/\.(docx?|pdf)$/i, '');
      const pdfName = `${baseName}.pdf`;

      // Crear registro primero para obtener el ID
      const pdfRecord = await (prisma as any).documentPdf.create({
        data: {
          documentId: docId,
          name: pdfName,
          size: BigInt(req.file.size),
          source,
          createdBy: req.user!.id,
        },
        include: {
          creator: { select: { id: true, name: true } },
        },
      });

      // Subir PDF a R2 (best-effort)
      try {
        const storage = getStorageProvider();
        const key = pdfKey(doc.firmId, doc.groupId, docId, pdfRecord.id);
        await storage.upload(key, req.file.buffer, 'application/pdf');
        await (prisma as any).documentPdf.update({
          where: { id: pdfRecord.id },
          data: { storageKey: key },
        });
        (pdfRecord as any).storageKey = key;
      } catch (e) {
        console.error('[PDF Upload] Error al subir PDF a R2:', (e as Error).message);
      }

      await prisma.activityLog.create({
        data: {
          firmId: req.user!.firmId ?? null,
          userId: req.user!.id,
          activity: 'DOCUMENT_EXTRACTED',
          entityType: 'document',
          entityId: docId,
          entityName: doc.name,
          description: `PDF guardado: ${pdfName}`,
          metadata: { source, pdfId: pdfRecord.id, size: req.file.size } as any,
        },
      });

      res.status(201).json(serializeBigInt(pdfRecord));
    } catch (error) {
      next(error);
    }
  },
);


// ─── GET /api/documents/:id/pdfs ─────────────────────────────────────────────
// Lista todos los PDFs convertidos enlazados a un documento
documentsRouter.get(
  '/:id/pdfs',
  validateParams(uuidParam),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = paramId(req);

      const pdfs = await (prisma as any).documentPdf.findMany({
        where: { documentId: docId },
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true } },
        },
      });

      res.json({ pdfs: serializeBigInt(pdfs) });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/documents/:id/pdfs/:pdfId/file ─────────────────────────────────
// Sirve el archivo PDF para preview / descarga
documentsRouter.get(
  '/:id/pdfs/:pdfId/file',
  validateParams(z.object({ id: z.string().uuid(), pdfId: z.string().uuid() })),
  requirePermission('download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pdfId = Array.isArray(req.params.pdfId) ? req.params.pdfId[0] : req.params.pdfId;

      const pdfRecord = await (prisma as any).documentPdf.findUniqueOrThrow({
        where: { id: pdfId, documentId: docId },
      });

      if (!pdfRecord.storageKey && !pdfRecord.driveFileId && !pdfRecord.localPath) {
        res.status(404).json({ error: 'Archivo PDF no disponible' });
        return;
      }

      const pdfBuffer = await downloadDocumentBuffer({
        storageKey: pdfRecord.storageKey,
        driveFileId: pdfRecord.driveFileId,
        localPath: pdfRecord.localPath,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdfRecord.name)}"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/documents/:id/pdfs/:pdfId ───────────────────────────────────
// Elimina un PDF enlazado (solo el creador o admin)
documentsRouter.delete(
  '/:id/pdfs/:pdfId',
  validateParams(z.object({ id: z.string().uuid(), pdfId: z.string().uuid() })),
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pdfId = Array.isArray(req.params.pdfId) ? req.params.pdfId[0] : req.params.pdfId;

      const pdfRecord = await (prisma as any).documentPdf.findUniqueOrThrow({
        where: { id: pdfId, documentId: docId },
        include: { document: { select: { ownerId: true } } },
      });

      const userId = req.user!.id;
      const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      const isCreator = pdfRecord.createdBy === userId;
      const isDocOwner = pdfRecord.document.ownerId === userId;
      const isAdmin = userRecord?.role === 'admin';

      if (!isCreator && !isDocOwner && !isAdmin) {
        res.status(403).json({ error: 'No tienes permiso para eliminar este PDF' });
        return;
      }

      // Borrar de R2 y Drive (mejor esfuerzo)
      if (pdfRecord.storageKey) {
        getStorageProvider().delete(pdfRecord.storageKey).catch(() => {});
      }
      if (pdfRecord.driveFileId) {
        const { deleteFile } = await import('../lib/googleDrive.js');
        deleteFile(pdfRecord.driveFileId).catch(() => {});
      }

      await (prisma as any).documentPdf.delete({ where: { id: pdfId } });

      res.json({ ok: true, message: 'PDF eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  },
);

