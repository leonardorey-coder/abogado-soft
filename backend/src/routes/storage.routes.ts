// =============================================================================
// storage.routes.ts — Storage API agnóstica (reemplaza drive.routes.ts)
//
// Endpoints:
//   GET  /api/storage/status                    — health-check del proveedor
//   POST /api/storage/upload-url                — URL firmada para subida directa
//   POST /api/storage/sync/:documentId          — sube base64 al proveedor activo
//   GET  /api/storage/sync/:documentId          — refresca lastSyncAt en BD
//   GET  /api/storage/versions/:documentId      — lista versiones en BD con storageKey
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, uuidParam } from '../middleware/validate.js';
import {
  getStorageProvider,
  docKey,
  versionKey,
  downloadDocumentBuffer,
} from '../lib/storage/index.js';

export const storageRouter = Router();

// Todas las rutas requieren autenticación
storageRouter.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMimeType(docType: string): string {
  const map: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    txt: 'text/plain',
    rtf: 'application/rtf',
  };
  return map[docType.toLowerCase()] ?? 'application/octet-stream';
}

// ─── GET /api/storage/status ──────────────────────────────────────────────────
storageRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const storage = getStorageProvider();
    const connected = await storage.healthCheck();
    res.json({ connected, provider: process.env.STORAGE_PROVIDER ?? 'r2' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/storage/upload-url ─────────────────────────────────────────────
// Genera una URL firmada (presigned PUT) para subida directa cliente→R2.
const uploadUrlSchema = z.object({
  documentId: z.string().uuid(),
  mimeType: z.string().min(1),
});

storageRouter.post(
  '/upload-url',
  validate(uploadUrlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId, mimeType } = req.body as z.infer<typeof uploadUrlSchema>;
      const storage = getStorageProvider();

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: documentId },
        select: { id: true, type: true, groupId: true, firmId: true },
      });

      const key = docKey(doc.firmId, doc.groupId, doc.id, doc.type);
      const uploadUrl = await storage.getSignedUploadUrl(key, mimeType, 900);

      res.json({ uploadUrl, storageKey: key });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/storage/sync/:documentId ──────────────────────────────────────
// Recibe el archivo como base64 y lo sube al proveedor de almacenamiento.
storageRouter.post(
  '/sync/:documentId',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    const docId = Array.isArray(req.params.documentId)
      ? req.params.documentId[0]
      : req.params.documentId;

    try {
      if (!req.body.content) {
        res.status(400).json({ error: 'Se requiere el campo "content" (base64).' });
        return;
      }

      const content = Buffer.from(req.body.content, 'base64');
      const changeNote: string | undefined = req.body.changeNote;
      const createVersion: boolean = req.body.createVersion === true;

      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: {
          id: true, name: true, type: true, groupId: true, firmId: true,
          version: true, storageKey: true, driveFileId: true, localPath: true,
        },
      });

      const mimeType = getMimeType(doc.type);
      const storage = getStorageProvider();
      const dKey = docKey(doc.firmId, doc.groupId, doc.id, doc.type);

      await prisma.document.update({ where: { id: docId }, data: { syncStatus: 'syncing' } });

      try {
        if (createVersion) {
          const newVersion = doc.version + 1;
          const vKey = versionKey(doc.firmId, doc.groupId, doc.id, newVersion, doc.type);

          // Snapshot atómico: copy → update
          if (doc.storageKey) {
            await storage.copy(doc.storageKey, vKey);
          } else {
            await storage.upload(vKey, content, mimeType);
          }
          await storage.update(dKey, content, mimeType);

          await prisma.$transaction([
            prisma.document.update({
              where: { id: docId },
              data: {
                storageKey: dKey,
                version: newVersion,
                syncStatus: 'completed',
                lastSyncAt: new Date(),
              },
            }),
            prisma.documentVersion.create({
              data: {
                documentId: docId,
                version: newVersion,
                storageKey: vKey,
                size: BigInt(content.byteLength),
                changeNote: changeNote ?? null,
                createdBy: req.user!.id,
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
                description: `Nueva versión ${newVersion}${changeNote ? `: ${changeNote}` : ''}`,
              },
            }),
          ]);

          res.json({ ok: true, storageKey: dKey, version: newVersion, lastSyncAt: new Date().toISOString() });
        } else {
          await storage.update(dKey, content, mimeType);

          await prisma.document.update({
            where: { id: docId },
            data: { storageKey: dKey, syncStatus: 'completed', lastSyncAt: new Date() },
          });

          res.json({ ok: true, storageKey: dKey, version: doc.version, lastSyncAt: new Date().toISOString() });
        }
      } catch (uploadErr) {
        await prisma.document.update({ where: { id: docId }, data: { syncStatus: 'failed' } });
        throw uploadErr;
      }
    } catch (error: any) {
      next(error);
    }
  },
);

// ─── GET /api/storage/sync/:documentId ───────────────────────────────────────
// Refresca lastSyncAt (confirma que el archivo existe en R2).
storageRouter.get(
  '/sync/:documentId',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    const docId = Array.isArray(req.params.documentId)
      ? req.params.documentId[0]
      : req.params.documentId;

    try {
      const doc = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: { storageKey: true, driveFileId: true, localPath: true },
      });

      if (!doc.storageKey && !doc.driveFileId && !doc.localPath) {
        res.status(404).json({ error: 'El documento no tiene archivo en ningún almacenamiento.' });
        return;
      }

      await prisma.document.update({
        where: { id: docId },
        data: { lastSyncAt: new Date(), syncStatus: 'completed' },
      });

      res.json({ ok: true, storageKey: doc.storageKey, lastSyncAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/storage/versions/:documentId ────────────────────────────────────
// Lista versiones del documento con sus storageKeys.
storageRouter.get(
  '/versions/:documentId',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    const docId = Array.isArray(req.params.documentId)
      ? req.params.documentId[0]
      : req.params.documentId;

    try {
      const versions = await prisma.documentVersion.findMany({
        where: { documentId: docId },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { version: 'desc' },
      });

      res.json({ versions });
    } catch (error) {
      next(error);
    }
  },
);
