import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import * as Diff from 'diff';
import * as XLSX from 'xlsx';
import { getSearchServiceSync } from '../services/search/SearchServiceFactory.js';
import { hasRecentDocumentViewedLog } from '../lib/activityViewLog.js';


// ─── Diff summary helper (convenios) ─────────────────────────────────────────────────
interface ConvenioDiffSummary {
  linesAdded: number;
  linesRemoved: number;
  sampleLines: { type: 'added' | 'removed'; content: string }[];
}

function computeConvenioDiffSummary(oldData: any, newData: any): ConvenioDiffSummary | null {
  try {
    const oldText = JSON.stringify(oldData ?? {}, null, 2);
    const newText = JSON.stringify(newData ?? {}, null, 2);
    const diffs = Diff.diffLines(oldText, newText);
    let linesAdded = 0;
    let linesRemoved = 0;
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
  } catch {
    return null;
  }
}


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
  tableData: z.any().optional(),
});

const updateConvenioSchema = createConvenioSchema.partial();

const conveniosQuerySchema = paginationQuery.extend({
  estado: z.enum(['activo', 'pendiente', 'vencido', 'expirado', 'cancelado']).optional(),
  documentType: z.enum(['docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt', 'rtf']).optional(),
  search: z.string().optional(),
});

// ─── GET /api/convenios ─────────────────────────────────────────────────────
conveniosRouter.get(
  '/',
  validateQuery(conveniosQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, estado, search, documentType } = req.query as any;
      const skip = (page - 1) * limit;
      const where: any = {};

      if (estado) where.estado = estado;
      if (documentType) {
        where.documents = {
          some: {
            document: { type: documentType },
          },
        };
      }
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
            documents: {
              take: 1,
              include: {
                document: { select: { id: true, name: true, type: true, fileStatus: true } },
              },
            },
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
            take: 20,
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

      // ── Fire-and-forget: registrar apertura para "Abierto recientemente" ──
      (async () => {
        try {
          const dup = await hasRecentDocumentViewedLog({
            userId: req.user!.id,
            entityType: 'convenio',
            entityId: convenio.id,
          });
          if (dup) return;
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              activity: 'DOCUMENT_VIEWED',
              entityType: 'convenio',
              entityId: convenio.id,
              entityName: `${convenio.numero} – ${convenio.institucion}`,
              description: `Convenio abierto: ${convenio.numero}`,
            },
          });
        } catch (err) {
          console.error('[Convenio open tracking] Error:', err);
        }
      })();
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

      // ── Fire-and-forget: indexar en búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (!svc) return;
          await svc.indexDocument({
            id: convenio.id,
            entityType: 'convenio',
            title: `${convenio.numero} — ${convenio.institucion}`,
            subtitle: convenio.descripcion ?? undefined,
            textContent: [convenio.descripcion, convenio.notas].filter(Boolean).join(' '),
            url: `/convenios/${convenio.id}`,
            meta: { estado: convenio.estado },
            updatedAt: convenio.updatedAt.toISOString(),
          });
        } catch (err) {
          console.warn('[Search] Error indexando convenio:', (err as Error).message);
        }
      })();
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

      // ── Fire-and-forget: re-indexar en búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (!svc) return;
          await svc.indexDocument({
            id: convenio.id,
            entityType: 'convenio',
            title: `${convenio.numero} — ${convenio.institucion}`,
            subtitle: convenio.descripcion ?? undefined,
            textContent: [convenio.descripcion, convenio.notas].filter(Boolean).join(' '),
            url: `/convenios/${convenio.id}`,
            meta: { estado: convenio.estado },
            updatedAt: convenio.updatedAt.toISOString(),
          });
        } catch (err) {
          console.warn('[Search] Error re-indexando convenio:', (err as Error).message);
        }
      })();
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

      // ── Fire-and-forget: eliminar del índice de búsqueda ──
      ;(async () => {
        try {
          const svc = getSearchServiceSync();
          if (svc) await svc.removeDocument(convenio.id, 'convenio');
        } catch (err) {
          console.warn('[Search] Error eliminando convenio del índice:', (err as Error).message);
        }
      })();
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
      const convenioId = req.params.id;
      const convMeta = await prisma.convenio.findUnique({
        where: { id: convenioId },
        select: { numero: true, institucion: true },
      });
      if (!convMeta) {
        res.status(404).json({ error: 'Convenio no encontrado' });
        return;
      }
      const entityName = `${convMeta.numero} – ${convMeta.institucion}`;

      const comment = await prisma.convenioComment.create({
        data: {
          convenioId,
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
          entityId: convenioId,
          entityName,
          description: `Comentario en convenio: ${entityName}`,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/convenios/:id/save-table ──────────────────────────────────────
const saveTableSchema = z.object({
  tableData: z.object({
    columns: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['text', 'date', 'status', 'number']).default('text'),
    })),
    rows: z.array(z.object({
      id: z.string(),
      cells: z.record(z.string(), z.string()),
    })),
  }),
  changeNote: z.string().optional(),
  createVersion: z.boolean().default(false),
});

conveniosRouter.post(
  '/:id/save-table',
  validateParams(uuidParam),
  validate(saveTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableData, changeNote, createVersion } = req.body;
      const convenioId = req.params.id;

      const conv = await prisma.convenio.findUniqueOrThrow({
        where: { id: convenioId },
      });

      const isAdmin = req.user!.role === 'admin';
      const isResponsable = conv.responsableId === req.user!.id;
      if (!isAdmin && !isResponsable) {
        res.status(403).json({ error: 'No tienes permiso para editar este convenio' });
        return;
      }

      if (createVersion) {
        const newVersionNum = conv.version + 1;

        const diffSummary = computeConvenioDiffSummary(conv.tableData, tableData);

        const [version] = await prisma.$transaction([
          prisma.convenioVersion.create({
            data: {
              convenioId,
              version: newVersionNum,
              createdBy: req.user!.id,
              snapshotData: { ...conv, tableData: conv.tableData } as any,
              changeNote: changeNote || `Tabla guardada v${newVersionNum}`,
            },
          }),
          prisma.convenio.update({
            where: { id: convenioId },
            data: { tableData: tableData as any, version: newVersionNum },
          }),
        ]);

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'CONVENIO_VERSION_CREATED' as any,
            entityType: 'convenio',
            entityId: convenioId,
            entityName: conv.numero,
            description: `Tabla guardada con nueva versión (v${newVersionNum})`,
            metadata: ({ version: newVersionNum, changeNote, ...(diffSummary ? { diffSummary } : {}) } as any),
          },
        });

        res.json({ ok: true, version: newVersionNum, versionId: version.id });
      } else {
        const diffSummary = computeConvenioDiffSummary(conv.tableData, tableData);

        await prisma.convenio.update({
          where: { id: convenioId },
          data: { tableData: tableData as any },
        });

        await prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            activity: 'CONVENIO_UPDATED' as any,
            entityType: 'convenio',
            entityId: convenioId,
            entityName: conv.numero,
            description: 'Tabla actualizada',
            metadata: diffSummary ? ({ diffSummary } as any) : undefined,
          },
        });

        res.json({ ok: true, version: conv.version });
      }
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/convenios/:id/export-xlsx ──────────────────────────────────────
conveniosRouter.get(
  '/:id/export-xlsx',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conv = await prisma.convenio.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { numero: true, institucion: true, tableData: true },
      });

      const tableData = conv.tableData as any;
      if (!tableData?.columns || !tableData?.rows) {
        res.status(400).json({ error: 'Este convenio no tiene datos de tabla' });
        return;
      }

      const headers = tableData.columns.map((c: any) => c.name);
      const rows = tableData.rows.map((row: any) =>
        tableData.columns.map((col: any) => row.cells[col.id] || ''),
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Convenio');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `${conv.numero}_${conv.institucion}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buf));
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
