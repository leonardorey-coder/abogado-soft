// ============================================================================
// Google Drive Service — Integración con Google Drive API v3
// Almacenamiento en nube sin VPS: upload/download/versiones via Service Account
// ============================================================================

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

// ─── Service Account Client ─────────────────────────────────────────────────

let driveClient: drive_v3.Drive | null = null;

function usingServiceAccount(): boolean {
    return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PATH?.trim());
}

async function resolveUploadParent(folderId?: string): Promise<string> {
    const trimmed = folderId?.trim();
    if (trimmed) return trimmed;
    if (usingServiceAccount()) {
        throw new Error(
            '[GoogleDrive] Con cuenta de servicio no hay cuota en el Drive de la SA. ' +
                'Define GOOGLE_DRIVE_FOLDER_DOCUMENTS, CONTRACTS y BACKUPS (IDs de carpetas en una unidad compartida o carpetas ' +
                'compartidas con el client_email del JSON). No uses el fallback sin carpeta.',
        );
    }
    return getOrCreateFolder();
}

function resolveServiceAccountFilePath(serviceAccountPath: string): string {
    const trimmed = serviceAccountPath.trim();
    if (!trimmed) {
        throw new Error('[GoogleDrive] GOOGLE_SERVICE_ACCOUNT_PATH está vacío.');
    }
    if (path.isAbsolute(trimmed)) {
        if (!fs.existsSync(trimmed)) {
            throw new Error(`[GoogleDrive] Archivo de Service Account no encontrado: ${trimmed}`);
        }
        return trimmed;
    }
    const inBackend = path.join(process.cwd(), trimmed);
    const inRepoRoot = path.join(process.cwd(), '..', trimmed);
    if (fs.existsSync(inBackend)) return inBackend;
    if (fs.existsSync(inRepoRoot)) return inRepoRoot;
    throw new Error(
        `[GoogleDrive] Archivo de Service Account no encontrado. Probado: ${inBackend} y ${inRepoRoot}`,
    );
}

export function getDriveClient(): drive_v3.Drive {
    if (driveClient) return driveClient;

    // Prioridad: Service Account > OAuth2
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath?.trim()) {
        const absolutePath = resolveServiceAccountFilePath(serviceAccountPath);

        const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        driveClient = google.drive({ version: 'v3', auth });
        console.log('[GoogleDrive] Autenticado con Service Account:', credentials.client_email);
        return driveClient;
    }

    // ─── Fallback: OAuth2 (legacy) ──────────────────────────────────────────
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            '[GoogleDrive] Configura GOOGLE_SERVICE_ACCOUNT_PATH o las variables OAuth2: ' +
            'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN'
        );
    }

    const auth = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/drive/auth/callback',
    );

    auth.setCredentials({ refresh_token: refreshToken });

    driveClient = google.drive({ version: 'v3', auth });
    console.log('[GoogleDrive] Autenticado con OAuth2');
    return driveClient;
}

// ─── Reset del cliente (útil para testing o cambio de credenciales) ─────────

export function resetDriveClient(): void {
    driveClient = null;
    cachedFolderId = null;
}

// ─── Obtener/crear carpeta base de AbogadoSoft ──────────────────────────────

let cachedFolderId: string | null = null;

export async function getOrCreateFolder(name = 'AbogadoSoft'): Promise<string> {
    if (cachedFolderId) return cachedFolderId;

    const drive = getDriveClient();

    const res = await drive.files.list({
        q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (res.data.files && res.data.files.length > 0) {
        cachedFolderId = res.data.files[0].id!;
        return cachedFolderId;
    }

    const folder = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
        supportsAllDrives: true,
    });

    cachedFolderId = folder.data.id!;
    return cachedFolderId;
}

// ─── Upload de archivo (crear nuevo en Drive) ───────────────────────────────

export interface DriveUploadResult {
    driveFileId: string;
    driveRevisionId: string | null;
    webViewLink: string | null;
}

export async function uploadFile(
    name: string,
    mimeType: string,
    content: Buffer,
    folderId?: string,
): Promise<DriveUploadResult> {
    const drive = getDriveClient();
    const folder = await resolveUploadParent(folderId);

    const res = await drive.files.create({
        requestBody: {
            name,
            parents: [folder],
        },
        media: {
            mimeType,
            body: Readable.from(content),
        },
        fields: 'id, webViewLink, headRevisionId',
        supportsAllDrives: true,
    });

    return {
        driveFileId: res.data.id!,
        driveRevisionId: res.data.headRevisionId ?? null,
        webViewLink: res.data.webViewLink ?? null,
    };
}

// ─── Upload de archivo por Stream (para archivos grandes) ───────────────────

export async function uploadFileStream(
    name: string,
    mimeType: string,
    filePath: string,
    folderId?: string,
): Promise<DriveUploadResult> {
    const drive = getDriveClient();
    const folder = await resolveUploadParent(folderId);

    const res = await drive.files.create({
        requestBody: {
            name,
            parents: [folder],
        },
        media: {
            mimeType,
            body: fs.createReadStream(filePath),
        },
        fields: 'id, webViewLink, headRevisionId',
        supportsAllDrives: true,
    });

    return {
        driveFileId: res.data.id!,
        driveRevisionId: res.data.headRevisionId ?? null,
        webViewLink: res.data.webViewLink ?? null,
    };
}

// ─── Actualizar archivo ya existente en Drive ────────────────────────────────

export async function updateFile(
    driveFileId: string,
    mimeType: string,
    content: Buffer,
): Promise<{ driveRevisionId: string | null }> {
    const drive = getDriveClient();

    const res = await drive.files.update({
        fileId: driveFileId,
        media: {
            mimeType,
            body: Readable.from(content),
        },
        fields: 'id, headRevisionId',
        supportsAllDrives: true,
    });

    return { driveRevisionId: res.data.headRevisionId ?? null };
}

// ─── Descargar archivo desde Drive ──────────────────────────────────────────

export async function downloadFile(driveFileId: string): Promise<Buffer> {
    const drive = getDriveClient();

    const res = await drive.files.get(
        { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' },
    );

    return Buffer.from(res.data as ArrayBuffer);
}

// ─── Descargar archivo desde Drive por Stream ───────────────────────────────

export async function downloadFileStream(driveFileId: string): Promise<Readable> {
    const drive = getDriveClient();

    const res = await drive.files.get(
        { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
    );

    return res.data as Readable;
}

// ─── Listar revisiones de un archivo en Drive ───────────────────────────────

export interface DriveRevision {
    id: string;
    modifiedTime: string | null | undefined;
    size: string | null | undefined;
    lastModifyingUser: string | null;
}

export async function getRevisions(driveFileId: string): Promise<DriveRevision[]> {
    const drive = getDriveClient();

    const res = await drive.revisions.list({
        fileId: driveFileId,
        fields: 'revisions(id, modifiedTime, size, lastModifyingUser)',
    });

    return (res.data.revisions ?? []).map((r) => ({
        id: r.id!,
        modifiedTime: r.modifiedTime,
        size: r.size,
        lastModifyingUser: r.lastModifyingUser?.displayName ?? null,
    }));
}

// ─── Descargar una revisión específica ──────────────────────────────────────

export async function downloadRevision(driveFileId: string, revisionId: string): Promise<Buffer> {
    const drive = getDriveClient();

    // NOTE: La API de revisiones no tiene alt:media en el cliente oficial de google.
    // Se usa el endpoint de export/download directo via HTTP.
    const res = await drive.revisions.get(
        { fileId: driveFileId, revisionId, alt: 'media', supportsAllDrives: true } as any,
        { responseType: 'arraybuffer' },
    );

    return Buffer.from((res as any).data as ArrayBuffer);
}

// ─── Eliminar archivo de Drive ───────────────────────────────────────────────

export async function deleteFile(driveFileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
}

// ─── Verificar si las credenciales son válidas ──────────────────────────────

export async function verifyCredentials(): Promise<boolean> {
    try {
        const drive = getDriveClient();
        await drive.files.list({
            pageSize: 1,
            fields: 'files(id)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        return true;
    } catch {
        return false;
    }
}
