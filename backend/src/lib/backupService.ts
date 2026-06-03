import prisma from './prisma.js';
import fs from 'fs';
import path from 'path';
import { getStorageProvider, backupKey } from './storage/index.js';
import archiver from 'archiver';

export const activeBackupsProgress = new Map<string, number>();

function sanitizeZipEntryName(value: string): string {
    const sanitized = value
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return sanitized || 'archivo_sin_nombre';
}

function buildUniqueEntryName(baseName: string, usedNames: Set<string>): string {
    const parsed = path.parse(baseName);
    const name = parsed.name || 'archivo';
    const ext = parsed.ext || '';
    let candidate = `${name}${ext}`;
    let i = 1;
    while (usedNames.has(candidate)) {
        candidate = `${name} (${i})${ext}`;
        i++;
    }
    usedNames.add(candidate);
    return candidate;
}

function getExtensionFolder(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase().replace('.', '').trim();
    return ext || 'sin_extension';
}

type BackupSourceFile = {
    id: string;
    name: string;
    storageKey: string | null;
};

async function createZipFromSourceFiles(zipFilePath: string, files: BackupSourceFile[]): Promise<void> {
    const storage = getStorageProvider();
    const usedNamesByFolder = new Map<string, Set<string>>();

    await new Promise<void>(async (resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('warning', (err) => {
            if ((err as any).code !== 'ENOENT') reject(err);
        });
        archive.on('error', reject);
        archive.pipe(output);

        try {
            for (const file of files) {
                const baseName = sanitizeZipEntryName(file.name);
                const folder = getExtensionFolder(baseName);
                const folderUsedNames = usedNamesByFolder.get(folder) ?? new Set<string>();
                usedNamesByFolder.set(folder, folderUsedNames);
                const uniqueName = buildUniqueEntryName(baseName, folderUsedNames);
                const entryName = `${folder}/${uniqueName}`;
                if (!file.storageKey) continue;
                const stream = await storage.downloadStream(file.storageKey);
                archive.append(stream as any, { name: entryName });
            }

            await archive.finalize();
        } catch (error) {
            reject(error);
        }
    });
}

export async function generateSystemBackup(
    manualName: string | null = null,
    backupType: string = 'full',
    userId: string | null = null,
    firmId: string | null = null
): Promise<string> {
    const sourceFiles = await prisma.document.findMany({
        where: {
            isDeleted: false,
            ...(firmId ? { firmId } : {}),
            storageKey: { not: null },
        },
        select: {
            id: true,
            name: true,
            storageKey: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    const backupRecord = await prisma.backup.create({
        data: {
            name: manualName || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`,
            type: backupType,
            status: 'in_progress',
            size: null,
            filePath: null,
            firmId: firmId ?? undefined,
            startedAt: new Date(),
            documentsCount: sourceFiles.length,
            createdBy: userId ?? 'system_cron',
        },
    });

    activeBackupsProgress.set(backupRecord.id, 10);

    // Ejecutar en background (async real)
    (async () => {
        try {
            if (sourceFiles.length === 0) {
                throw new Error('No hay archivos del despacho disponibles para respaldar.');
            }

            const zipFileName = `${backupRecord.name}.zip`;
            const zipFilePath = path.join(process.cwd(), zipFileName);

            // 1. Empaquetar archivos vigentes del despacho (R2/Drive legacy)
            activeBackupsProgress.set(backupRecord.id, 20);
            await createZipFromSourceFiles(zipFilePath, sourceFiles);

            const stats = fs.statSync(zipFilePath);

            // 2. Subir ZIP final
            activeBackupsProgress.set(backupRecord.id, 75);
            const storage = getStorageProvider();
            const bKey = backupKey(firmId, backupRecord.name);
            const zipStream = fs.createReadStream(zipFilePath);
            await storage.uploadStream(bKey, zipStream as any, 'application/zip', stats.size);

            // Limpiar archivo temporal tras subida exitosa
            if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);

            await prisma.backup.update({
                where: { id: backupRecord.id },
                data: {
                    status: 'completed',
                    size: stats.size,
                    storageKey: bKey,
                    completedAt: new Date(),
                },
            });
            const isAutomatic =
                !userId ||
                userId === 'system_cron' ||
                manualName === 'Respaldo Diario Automático' ||
                backupType.includes('_auto');
            await prisma.activityLog.create({
                data: {
                    firmId: firmId ?? null,
                    userId: userId && userId !== 'system_cron' ? userId : null,
                    activity: 'BACKUP_CREATED',
                    entityType: 'backup',
                    entityId: backupRecord.id,
                    entityName: backupRecord.name,
                    description: isAutomatic ? 'Respaldo automático completado' : 'Respaldo manual completado',
                    metadata: {
                        kind: 'backup_created',
                        trigger: isAutomatic ? 'automatic' : 'manual',
                        backupType,
                        backupId: backupRecord.id,
                        backupName: backupRecord.name,
                    },
                },
            });
            activeBackupsProgress.set(backupRecord.id, 100);
        } catch (error: any) {
            console.error('Backup Error:', error);
            // Cleanup if possible
            const zipFilePath = path.join(process.cwd(), `${backupRecord.name}.zip`);

            if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);

            await prisma.backup.update({
                where: { id: backupRecord.id },
                data: {
                    status: 'failed',
                    errorMessage: error.message,
                    completedAt: new Date(),
                },
            });
            activeBackupsProgress.delete(backupRecord.id);
        }
    })();

    return backupRecord.id;
}
