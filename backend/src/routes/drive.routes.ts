// ============================================================================
// Drive Routes — Sincronización con Google Drive
// Reemplaza el stack WebSocket/Liveblocks para almacenamiento en nube.
// Arquitectura: cliente guarda → backend sube a Drive → registra en DB
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, uuidParam } from '../middleware/validate.js';
import {
    uploadFile,
    updateFile,
    downloadFile,
    getRevisions,
    downloadRevision,
    verifyCredentials,
} from '../lib/googleDrive.js';
import path from 'path';
import fs from 'fs';

export const driveRouter = Router();

// Requiere autenticación para todo lo que sigue
driveRouter.use(authenticate);

const UPLOADS_DIR = path.resolve('uploads');

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

// ─── Sync helper reutilizable ────────────────────────────────────────────────
// Usado tanto por la ruta POST /api/drive/sync/:id como por
// POST /api/documents/:id/save para sincronizar a Drive automáticamente.

export async function syncDocumentToDrive(
    documentId: string,
    userId: string,
    changeNote?: string,
): Promise<{ ok: boolean; driveFileId: string; driveRevisionId: string | null; version: number }> {
    const doc = await prisma.document.findUniqueOrThrow({
        where: { id: documentId },
        select: {
            id: true, name: true, type: true,
            localPath: true, driveFileId: true, version: true,
        },
    });

    if (!doc.localPath) {
        throw new Error('El documento no tiene archivo local para sincronizar.');
    }

    const filePath = path.isAbsolute(doc.localPath)
        ? doc.localPath
        : path.join(UPLOADS_DIR, doc.localPath);

    if (!fs.existsSync(filePath)) {
        throw new Error('Archivo local no encontrado en el servidor.');
    }

    const content = fs.readFileSync(filePath);
    const mimeType = getMimeType(doc.type);

    // Marcar como syncing
    await prisma.document.update({
        where: { id: documentId },
        data: { syncStatus: 'syncing' },
    });

    let driveFileId = doc.driveFileId;
    let driveRevisionId: string | null = null;

    try {
        if (driveFileId) {
            const result = await updateFile(driveFileId, mimeType, content);
            driveRevisionId = result.driveRevisionId;
        } else {
            const result = await uploadFile(`${doc.name}.${doc.type}`, mimeType, content);
            driveFileId = result.driveFileId;
            driveRevisionId = result.driveRevisionId;
        }

        const newVersion = doc.version + 1;

        await prisma.$transaction([
            prisma.document.update({
                where: { id: documentId },
                data: {
                    driveFileId,
                    driveRevisionId,
                    lastSyncAt: new Date(),
                    syncStatus: 'completed',
                    version: newVersion,
                },
            }),
            prisma.documentVersion.create({
                data: {
                    documentId,
                    version: newVersion,
                    cloudUrl: driveFileId,
                    driveRevisionId,
                    changeNote: changeNote ?? null,
                    createdBy: userId,
                } as any,
            }),
            prisma.documentSyncLog.create({
                data: {
                    documentId,
                    userId,
                    operation: 'update',
                    status: 'completed',
                    driveRevisionId,
                },
            }),
            prisma.activityLog.create({
                data: {
                    userId,
                    activity: 'DOCUMENT_UPDATED',
                    entityType: 'document',
                    entityId: documentId,
                    entityName: doc.name,
                    description: `Documento sincronizado con Google Drive (versión ${newVersion})`,
                },
            }),
        ]);

        return { ok: true, driveFileId: driveFileId!, driveRevisionId, version: newVersion };
    } catch (error) {
        await prisma.document.update({
            where: { id: documentId },
            data: { syncStatus: 'failed' },
        }).catch(() => { });
        await prisma.documentSyncLog.create({
            data: {
                documentId,
                userId,
                operation: 'update',
                status: 'failed',
                errorMessage: (error as Error).message,
            },
        }).catch(() => { });
        throw error;
    }
}

// ─── GET /api/drive/status ───────────────────────────────────────────────────
// Verifica si las credenciales de Google Drive están configuradas y válidas.

driveRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const ok = await verifyCredentials();
        res.json({ connected: ok });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/drive/sync/:documentId ───────────────────────────────────────
// Sube el archivo local del documento a Google Drive.
// Si ya tiene driveFileId, actualiza; si no, crea nuevo.
// Ahora delega en syncDocumentToDrive() para DRY.

driveRouter.post(
    '/sync/:documentId',
    validateParams(uuidParam),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId } = req.params;
        try {
            const result = await syncDocumentToDrive(
                Array.isArray(documentId) ? documentId[0] : documentId,
                req.user!.id,
                req.body.changeNote,
            );
            res.json({ ...result, lastSyncAt: new Date().toISOString() });
        } catch (error: any) {
            if (error.message?.includes('no tiene archivo local') || error.message?.includes('no encontrado')) {
                res.status(400).json({ error: error.message });
                return;
            }
            next(error);
        }
    },
);

// ─── GET /api/drive/sync/:documentId ────────────────────────────────────────
// Descarga la versión en Drive y actualiza el archivo local.

driveRouter.get(
    '/sync/:documentId',
    validateParams(uuidParam),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId } = req.params;
        try {
            const doc = await prisma.document.findUniqueOrThrow({
                where: { id: documentId },
                select: { id: true, name: true, type: true, localPath: true, driveFileId: true },
            });

            if (!doc.driveFileId) {
                res.status(404).json({ error: 'El documento aún no ha sido sincronizado con Google Drive.' });
                return;
            }

            const content = await downloadFile(doc.driveFileId);

            const fileName = `${doc.id}.${doc.type}`;
            const localPath = path.join(UPLOADS_DIR, fileName);
            fs.writeFileSync(localPath, content);

            await prisma.document.update({
                where: { id: documentId },
                data: { localPath: fileName, lastSyncAt: new Date(), syncStatus: 'completed' },
            });

            await prisma.documentSyncLog.create({
                data: {
                    documentId,
                    userId: req.user!.id,
                    operation: 'update',
                    status: 'completed',
                    driveRevisionId: doc.driveFileId,
                },
            });

            res.json({ ok: true, localPath: fileName, lastSyncAt: new Date().toISOString() });
        } catch (error) {
            next(error);
        }
    },
);

// ─── GET /api/drive/revisions/:documentId ───────────────────────────────────
// Lista las revisiones del documento en Google Drive.

driveRouter.get(
    '/revisions/:documentId',
    validateParams(uuidParam),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId } = req.params;
        try {
            const doc = await prisma.document.findUniqueOrThrow({
                where: { id: documentId },
                select: { driveFileId: true },
            });

            if (!doc.driveFileId) {
                res.json({ revisions: [] });
                return;
            }

            const driveRevisions = await getRevisions(doc.driveFileId);

            // Enriquecer con datos locales (versiones guardadas en DB)
            const dbVersions = await prisma.documentVersion.findMany({
                where: { documentId },
                include: { creator: { select: { id: true, name: true } } },
                orderBy: { version: 'desc' },
            });

            res.json({ revisions: driveRevisions, versions: dbVersions });
        } catch (error) {
            next(error);
        }
    },
);

// ─── GET /api/drive/revisions/:documentId/:revisionId ───────────────────────
// Descarga una revisión específica como blob.

driveRouter.get(
    '/revisions/:documentId/:revisionId',
    validateParams(z.object({ documentId: z.string().uuid(), revisionId: z.string().min(1) })),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId, revisionId } = req.params;
        try {
            const doc = await prisma.document.findUniqueOrThrow({
                where: { id: documentId },
                select: { driveFileId: true, name: true, type: true },
            });

            if (!doc.driveFileId) {
                res.status(404).json({ error: 'El documento no tiene un archivo en Drive.' });
                return;
            }

            const content = await downloadRevision(doc.driveFileId, revisionId);

            res.setHeader('Content-Type', getMimeType(doc.type));
            res.setHeader('Content-Disposition', `attachment; filename="${doc.name}_rev${revisionId}.${doc.type}"`);
            res.send(content);
        } catch (error) {
            next(error);
        }
    },
);


