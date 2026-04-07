import prisma from './prisma.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getStorageProvider, backupKey } from './storage/index.js';


const execAsync = promisify(exec);

export const activeBackupsProgress = new Map<string, number>();

function sanitizeDbUrlForPgDump(connectionString: string): string {
    try {
        const parsedUrl = new URL(connectionString);
        parsedUrl.searchParams.delete('pgbouncer');
        return parsedUrl.toString();
    } catch {
        return connectionString
            .replace(/[?&]pgbouncer=true&?/i, '?')
            .replace(/[?&]pgbouncer=false&?/i, '?')
            .replace(/\?$/, '');
    }
}

function escapeForDoubleQuotes(input: string): string {
    return input.replace(/(["\\$`])/g, '\\$1');
}

async function tryRunPgDump(binaryPath: string, connectionString: string, outputPath: string): Promise<boolean> {
    const safeBinary = escapeForDoubleQuotes(binaryPath);
    const safeUrl = escapeForDoubleQuotes(connectionString);
    const safeOutput = escapeForDoubleQuotes(outputPath);
    const command = `"${safeBinary}" "${safeUrl}" -F p -f "${safeOutput}"`;

    try {
        await execAsync(command);
        return true;
    } catch {
        return false;
    }
}

async function runPgDumpWithFallback(connectionString: string, outputPath: string): Promise<void> {
    const safeUrl = escapeForDoubleQuotes(connectionString);
    const safeOutput = escapeForDoubleQuotes(outputPath);
    const localPgDumpCommand = `pg_dump "${safeUrl}" -F p -f "${safeOutput}"`;

    try {
        await execAsync(localPgDumpCommand);
        return;
    } catch (error: any) {
        const stderr = String(error?.stderr || '');
        const hasVersionMismatch = stderr.includes('server version mismatch');

        if (!hasVersionMismatch) {
            throw error;
        }

        const pgDumpCandidates = [
            process.env.PG_DUMP_PATH,
            '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
            '/usr/local/opt/postgresql@17/bin/pg_dump',
        ].filter((value): value is string => Boolean(value && value.trim()));

        for (const candidate of pgDumpCandidates) {
            const worked = await tryRunPgDump(candidate, connectionString, outputPath);
            if (worked) return;
        }

        const dockerInstalled = await execAsync('docker --version').then(() => true).catch(() => false);
        if (!dockerInstalled) {
            throw new Error(
                'pg_dump local es incompatible con la version del servidor (v17). ' +
                'Instala PostgreSQL client v17 o configura PG_DUMP_PATH con la ruta de pg_dump v17.'
            );
        }

        const dockerDaemonUp = await execAsync('docker info').then(() => true).catch(() => false);
        if (!dockerDaemonUp) {
            throw new Error(
                'Docker esta instalado pero el daemon no esta corriendo. ' +
                'Inicia Docker Desktop o instala PostgreSQL client v17 y configura PG_DUMP_PATH.'
            );
        }

        const workspaceDir = process.cwd();
        const outputFileName = path.basename(outputPath);
        const safeWorkspaceDir = escapeForDoubleQuotes(workspaceDir);
        const safeOutputFileName = escapeForDoubleQuotes(outputFileName);
        const dockerPgDumpCommand =
            `docker run --rm -v "${safeWorkspaceDir}:/work" postgres:17 ` +
            `pg_dump "${safeUrl}" -F p -f "/work/${safeOutputFileName}"`;

        try {
            await execAsync(dockerPgDumpCommand);
        } catch {
            throw new Error(
                'No se pudo ejecutar el fallback de Docker para pg_dump v17. ' +
                'Verifica Docker Desktop o usa PG_DUMP_PATH con pg_dump v17 local.'
            );
        }
    }
}

export async function generateSystemBackup(
    manualName: string | null = null,
    backupType: string = 'full',
    userId: string | null = null
): Promise<string> {
    const backupRecord = await prisma.backup.create({
        data: {
            name: manualName || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`,
            type: backupType,
            status: 'in_progress',
            size: null,
            filePath: null,
            startedAt: new Date(),
            documentsCount: await prisma.document.count({ where: { isDeleted: false } }),
            createdBy: userId ?? 'system_cron',
        },
    });

    activeBackupsProgress.set(backupRecord.id, 10);

    // Ejecutar en background (async real)
    (async () => {
        try {
            const timestamp = backupRecord.name.replace('backup_', '');
            const dbDumpPath = path.join(process.cwd(), `db_dump_${timestamp}.sql`);
            const uploadsDir = path.join(process.cwd(), 'uploads');
            const zipFileName = `${backupRecord.name}.zip`;
            const zipFilePath = path.join(process.cwd(), zipFileName);

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) throw new Error("No database URL provided for pg_dump");
            const pgDumpUrl = sanitizeDbUrlForPgDump(dbUrl);

            // 1. Export database
            activeBackupsProgress.set(backupRecord.id, 20);
            await runPgDumpWithFallback(pgDumpUrl, dbDumpPath);

            // 2. Compress DB and Uploads into a zip file
            activeBackupsProgress.set(backupRecord.id, 50);
            let zipCommand = `zip -r "${zipFilePath}" "${dbDumpPath}"`;
            if (fs.existsSync(uploadsDir)) {
                zipCommand = `zip -r "${zipFilePath}" "${dbDumpPath}" "${uploadsDir}"`;
            }
            await execAsync(zipCommand);

            const stats = fs.statSync(zipFilePath);

            // 3. Subir ZIP a R2 usando upload por stream (evita OOM con archivos grandes)
            activeBackupsProgress.set(backupRecord.id, 75);
            const storage = getStorageProvider();
            const bKey = backupKey(backupRecord.name);
            const zipStream = fs.createReadStream(zipFilePath);
            await storage.uploadStream(bKey, zipStream as any, 'application/zip', stats.size);

            // Limpiar archivos temporales tras subida exitosa
            if (fs.existsSync(dbDumpPath)) fs.unlinkSync(dbDumpPath);
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
            activeBackupsProgress.set(backupRecord.id, 100);
        } catch (error: any) {
            console.error('Backup Error:', error);
            // Cleanup if possible
            const timestamp = backupRecord.name.replace('backup_', '');
            const dbDumpPath = path.join(process.cwd(), `db_dump_${timestamp}.sql`);
            const zipFilePath = path.join(process.cwd(), `${backupRecord.name}.zip`);

            if (fs.existsSync(dbDumpPath)) fs.unlinkSync(dbDumpPath);
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
