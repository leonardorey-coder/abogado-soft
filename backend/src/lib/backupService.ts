import prisma from './prisma.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { uploadFileStream } from './googleDrive.js';


const execAsync = promisify(exec);

export const activeBackupsProgress = new Map<string, number>();

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

            // 1. Export database
            activeBackupsProgress.set(backupRecord.id, 20);
            await execAsync(`pg_dump "${dbUrl}" -F p -f "${dbDumpPath}"`);

            // 2. Compress DB and Uploads into a zip file
            activeBackupsProgress.set(backupRecord.id, 50);
            let zipCommand = `zip -r "${zipFilePath}" "${dbDumpPath}"`;
            if (fs.existsSync(uploadsDir)) {
                zipCommand = `zip -r "${zipFilePath}" "${dbDumpPath}" "${uploadsDir}"`;
            }
            await execAsync(zipCommand);

            const stats = fs.statSync(zipFilePath);

            // 3. Upload to Google Drive
            activeBackupsProgress.set(backupRecord.id, 75);
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_BACKUPS;
            const driveResult = await uploadFileStream(
                zipFileName,
                'application/zip',
                zipFilePath,
                folderId
            );

            // Cleanup local files after successful upload
            if (fs.existsSync(dbDumpPath)) fs.unlinkSync(dbDumpPath);
            if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);

            // Update successful record
            await prisma.backup.update({
                where: { id: backupRecord.id },
                data: {
                    status: 'completed',
                    size: stats.size,
                    cloudUrl: driveResult.driveFileId,
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
