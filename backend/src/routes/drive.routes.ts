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
import { google } from 'googleapis';
import crypto from 'crypto';
import {
    uploadFile,
    updateFile,
    downloadFile,
    getRevisions,
    downloadRevision,
    verifyCredentials,
    createResumableUploadSession,
} from '../lib/googleDrive.js';

export const driveRouter = Router();

const oauthStateMap = new Map<string, string>();

function getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/drive/auth/callback';

    if (!clientId || !clientSecret) {
        throw new Error('[GoogleDrive] Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

driveRouter.get(
    '/auth',
    (req: Request, res: Response, next: NextFunction) => {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH?.trim()) {
            res.status(400).json({
                error:
                    'Google Drive está configurado con cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_PATH). ' +
                    'No uses el flujo OAuth; comparte las carpetas de Drive con el client_email del JSON.',
            });
            return;
        }
        next();
    },
    authenticate,
    (req: Request, res: Response, next: NextFunction) => {
        try {
            const oauth2Client = getOAuthClient();
            const state = crypto.randomUUID();
            oauthStateMap.set(state, req.user!.id);

            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: ['https://www.googleapis.com/auth/drive'],
                state,
            });

            res.redirect(url);
        } catch (error) {
            next(error);
        }
    },
);

driveRouter.get('/auth/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');

        if (!code) {
            res.status(400).send('Falta el parametro "code".');
            return;
        }

        const userId = oauthStateMap.get(state);
        if (!userId || !state) {
            res.status(400).send('Estado OAuth invalido. Reintenta /api/drive/auth.');
            return;
        }

        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        const refreshToken = tokens.refresh_token;
        if (!refreshToken) {
            res.status(400).send(
                'Google no devolvio refresh_token. ' +
                'Revoca el acceso anterior de la app y reintenta /api/drive/auth.'
            );
            return;
        }

        oauthStateMap.delete(state);

        res.type('text/plain').send(
            [
                'OK. Copia esto en tu .env (raiz o backend/.env):',
                '',
                `GOOGLE_REFRESH_TOKEN="${refreshToken}"`,
                '',
                'Luego reinicia el backend.',
            ].join('\n')
        );
    } catch (error) {
        next(error);
    }
});

// A partir de aquí, todas las rutas requieren autenticación
driveRouter.use(authenticate);

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

export type SyncDocumentToDriveOptions = {
    /** Si true, no crea nueva versión ni incrementa; solo sube a Drive y actualiza campos. */
    skipNewVersion?: boolean;
};

/**
 * Sincroniza un documento con Google Drive.
 * @param documentId  UUID del documento en BD.
 * @param userId      UUID del usuario que dispara la acción.
 * @param content     Buffer con el contenido del archivo. Si se omite se lanza error.
 * @param changeNote  Nota de cambio opcional para la nueva versión.
 * @param options     Opciones adicionales.
 */
export async function syncDocumentToDrive(
    documentId: string,
    userId: string,
    content: Buffer,
    changeNote?: string,
    options: SyncDocumentToDriveOptions = {},
): Promise<{ ok: boolean; driveFileId: string; driveRevisionId: string | null; version: number }> {
    const { skipNewVersion = false } = options;

    const doc = await prisma.document.findUniqueOrThrow({
        where: { id: documentId },
        select: {
            id: true, name: true, type: true,
            driveFileId: true, version: true,
        },
    });

    const mimeType = getMimeType(doc.type);
    const convenioLinksCount = await prisma.convenioDocument.count({
        where: { documentId },
    });
    const isConvenioDocument = convenioLinksCount > 0;
    const documentsFolderId = process.env.GOOGLE_DRIVE_FOLDER_DOCUMENTS;
    const contractsFolderId = process.env.GOOGLE_DRIVE_FOLDER_CONTRACTS;
    const targetFolderId = isConvenioDocument ? contractsFolderId : documentsFolderId;
    const baseName = doc.name;
    const hasExtension = baseName.toLowerCase().endsWith(`.${doc.type.toLowerCase()}`);
    const driveFileName = hasExtension ? baseName : `${baseName}.${doc.type}`;

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
            const result = await uploadFile(driveFileName, mimeType, content, targetFolderId);
            driveFileId = result.driveFileId;
            driveRevisionId = result.driveRevisionId;
        }

        if (skipNewVersion) {
            await prisma.$transaction([
                prisma.document.update({
                    where: { id: documentId },
                    data: {
                        driveFileId,
                        driveRevisionId,
                        lastSyncAt: new Date(),
                        syncStatus: 'completed',
                    },
                }),
                prisma.documentVersion.updateMany({
                    where: { documentId, version: doc.version },
                    data: { cloudUrl: driveFileId },
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
            ]);
            return { ok: true, driveFileId: driveFileId!, driveRevisionId, version: doc.version };
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

// ─── POST /api/drive/upload-url ───────────────────────────────────────────────
// Inicia sesión resumable en Drive para subida directa cliente→Drive.
// Flujo: 1) cliente pide URL, 2) backend abre sesión en Drive y responde {uploadUrl, fileId},
// 3) cliente hace PUT <uploadUrl> con el binario directamente.

const uploadUrlSchema = z.object({
    name: z.string().min(1).max(500),
    mimeType: z.string().min(1),
    folderId: z.string().optional(),
});

driveRouter.post(
    '/upload-url',
    validate(uploadUrlSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, mimeType, folderId } = req.body as z.infer<typeof uploadUrlSchema>;

            const driveReady = await verifyCredentials();
            if (!driveReady) {
                res.status(503).json({ error: 'Google Drive no está configurado o no está disponible.' });
                return;
            }

            const session = await createResumableUploadSession(name, mimeType, folderId);
            res.json({ uploadUrl: session.uploadUrl, fileId: session.fileId });
        } catch (error) {
            next(error);
        }
    },
);

// ─── POST /api/drive/sync/:documentId ───────────────────────────────────────
// Sube el archivo (buffer en base64) a Google Drive.
// El body debe contener: { content: string (base64), changeNote?: string }

driveRouter.post(
    '/sync/:documentId',
    validateParams(uuidParam),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId } = req.params;
        try {
            const docId = Array.isArray(documentId) ? documentId[0] : documentId;

            // El contenido del archivo debe venir como base64 en el body
            // (para sincronización manual desde editor cuando el cliente ya tiene el buffer)
            if (!req.body.content) {
                res.status(400).json({ error: 'Se requiere el campo "content" (base64) con el contenido del archivo.' });
                return;
            }
            const content = Buffer.from(req.body.content, 'base64');

            const result = await syncDocumentToDrive(
                docId,
                req.user!.id,
                content,
                req.body.changeNote,
            );
            res.json({ ...result, lastSyncAt: new Date().toISOString() });
        } catch (error: any) {
            if (error.message?.includes('no tiene archivo')) {
                res.status(400).json({ error: error.message });
                return;
            }
            next(error);
        }
    },
);


// ─── GET /api/drive/sync/:documentId ────────────────────────────────────────
// Pull desde Drive: ya NO escribe en disco del servidor.
// Solo actualiza la marca de sincronización en BD.

driveRouter.get(
    '/sync/:documentId',
    validateParams(uuidParam),
    async (req: Request, res: Response, next: NextFunction) => {
        const { documentId } = req.params;
        try {
            const docId = Array.isArray(documentId) ? documentId[0] : documentId;
            const doc = await prisma.document.findUniqueOrThrow({
                where: { id: docId },
                select: { id: true, driveFileId: true },
            });

            if (!doc.driveFileId) {
                res.status(404).json({ error: 'El documento aún no ha sido sincronizado con Google Drive.' });
                return;
            }

            await prisma.document.update({
                where: { id: docId },
                data: { lastSyncAt: new Date(), syncStatus: 'completed' },
            });

            await prisma.documentSyncLog.create({
                data: {
                    documentId: docId,
                    userId: req.user!.id,
                    operation: 'update',
                    status: 'completed',
                    driveRevisionId: doc.driveFileId,
                },
            });

            res.json({
                ok: true,
                driveFileId: doc.driveFileId,
                lastSyncAt: new Date().toISOString(),
                message: 'Sync actualizado. El archivo se obtiene directamente desde Drive.',
            });
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
                where: { id: documentId as string },
                select: { driveFileId: true },
            });

            if (!doc.driveFileId) {
                res.json({ revisions: [] });
                return;
            }

            const driveRevisions = await getRevisions(doc.driveFileId);

            // Enriquecer con datos locales (versiones guardadas en DB)
            const dbVersions = await prisma.documentVersion.findMany({
                where: { documentId: documentId as string },
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
                where: { id: documentId as string },
                select: { driveFileId: true, name: true, type: true },
            });

            if (!doc.driveFileId) {
                res.status(404).json({ error: 'El documento no tiene un archivo en Drive.' });
                return;
            }

            const content = await downloadRevision(doc.driveFileId, revisionId as string);

            res.setHeader('Content-Type', getMimeType(doc.type));
            res.setHeader('Content-Disposition', `attachment; filename="${doc.name}_rev${revisionId}.${doc.type}"`);
            res.send(content);
        } catch (error) {
            next(error);
        }
    },
);


