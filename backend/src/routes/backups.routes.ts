import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export const backupsRouter = Router();
backupsRouter.use(authenticate);
backupsRouter.use(authorize('admin'));

const createBackupSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.enum(['full', 'incremental', 'documents_only', 'database_only']).default('full'),
});

// ─── GET /api/backups ───────────────────────────────────────────────────────
backupsRouter.get(
  '/',
  validateQuery(paginationQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as any;
      const skip = (page - 1) * limit;

      const [backups, total] = await Promise.all([
        prisma.backup.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            creator: { select: { id: true, name: true } },
          },
        }),
        prisma.backup.count(),
      ]);

      res.json({ data: backups, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/backups ──────────────────────────────────────────────────────
backupsRouter.post(
  '/',
  validate(createBackupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docCount = await prisma.document.count({ where: { isDeleted: false } });

      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const safeName = req.body.name.replace(/[^a-z0-9_-]/gi, '_');
      const filename = `backup_${safeName}_${Date.now()}.zip`;
      const filePath = path.join(backupDir, filename);

      const backup = await prisma.backup.create({
        data: {
          ...req.body,
          createdBy: req.user!.id,
          status: 'in_progress',
          documentsCount: docCount,
          startedAt: new Date(),
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'BACKUP_CREATED',
          entityType: 'backup',
          entityId: backup.id,
          entityName: backup.name,
          description: `Respaldo iniciado: ${backup.name} (${backup.type})`,
        },
      });

      res.status(201).json(backup);

      // --- Proceso asíncrono de respaldo ---
      (async () => {
        try {
          // Extraer base de datos
          const dbDump = {
            users: await prisma.user.findMany(),
            groups: await prisma.group.findMany(),
            groupMembers: await prisma.groupMember.findMany(),
            documents: await prisma.document.findMany(),
            documentPermissions: await prisma.documentPermission.findMany(),
            documentVersions: await prisma.documentVersion.findMany(),
            documentAssignments: await prisma.documentAssignment.findMany(),
            cases: await prisma.case.findMany(),
            convenios: await prisma.convenio.findMany(),
            convenioDocuments: await prisma.convenioDocument.findMany(),
            // Se excluyen activity logs o sessions por tamaño, o se incluyen limitados
          };

          const output = fs.createWriteStream(filePath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', async () => {
            await prisma.backup.update({
              where: { id: backup.id },
              data: {
                status: 'completed',
                completedAt: new Date(),
                filePath: filePath,
                size: BigInt(archive.pointer()),
              }
            });
          });

          archive.on('error', async (err: any) => {
            console.error('Backup ZIP Error:', err);
            await prisma.backup.update({
              where: { id: backup.id },
              data: { status: 'failed', errorMessage: err.message, completedAt: new Date() }
            });
          });

          archive.pipe(output);

          // Adjuntar JSON de BD
          const dbJsonStr = JSON.stringify(dbDump, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          );
          archive.append(dbJsonStr, { name: 'database.json' });

          // Si es 'full', adjuntar directorio de uploads
          if (req.body.type === 'full') {
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (fs.existsSync(uploadsDir)) {
              archive.directory(uploadsDir, 'uploads');
            }
          }

          await archive.finalize();
        } catch (err: any) {
          console.error("Backup Async Process Error:", err);
          await prisma.backup.update({
            where: { id: backup.id },
            data: { status: 'failed', errorMessage: err.message, completedAt: new Date() }
          });
        }
      })();

    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/backups/:id/download ──────────────────────────────────────────
backupsRouter.get(
  '/:id/download',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id },
      });

      if (backup.status !== 'completed' || !backup.filePath) {
        return res.status(400).json({ error: 'El respaldo no está completado o no tiene archivo' });
      }

      if (!fs.existsSync(backup.filePath)) {
        return res.status(404).json({ error: 'El archivo físico del respaldo ya no existe' });
      }

      res.download(backup.filePath, path.basename(backup.filePath));
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/backups/:id ───────────────────────────────────────────────────
backupsRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { creator: { select: { id: true, name: true } } },
      });
      res.json(backup);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/backups/:id ────────────────────────────────────────────────
backupsRouter.delete(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id }
      });

      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }

      await prisma.backup.delete({ where: { id: req.params.id } });

      res.json({ message: 'Respaldo eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }
);
