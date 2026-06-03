import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireFirm } from '../middleware/requireFirm.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import fs from 'fs';
import path from 'path';
import { getStorageProvider } from '../lib/storage/index.js';
import {
  generateSystemBackup,
  activeBackupsProgress
} from '../lib/backupService.js';

export const backupsRouter = Router();
backupsRouter.use(authenticate);
backupsRouter.use(requireFirm);
// authorize('admin') se aplica individualmente en POST y DELETE

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
      const firmId = req.user!.firmId!;

      const [backups, total] = await Promise.all([
        prisma.backup.findMany({
          where: { firmId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            creator: { select: { id: true, name: true } },
          },
        }),
        prisma.backup.count({ where: { firmId } }),
      ]);

      const backupsWithProgress = backups.map(b => {
        const progress = activeBackupsProgress.get(b.id);
        return {
          ...b,
          size: typeof b.size === 'bigint' ? b.size.toString() : b.size,
          progress: progress !== undefined ? progress : undefined
        };
      });

      res.json({ data: backupsWithProgress, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

backupsRouter.get(
  '/latest-daily',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar el respaldo automático más reciente que sea de hoy y esté completado
      const backup = await prisma.backup.findFirst({
        where: {
          name: 'Respaldo Diario Automático',
          status: 'completed',
          OR: [
            { storageKey: { not: null } },
            { cloudUrl: { not: null } },
            { filePath: { not: null } },
          ],
          createdAt: { gte: today },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
        }
      });

      if (!backup) {
        res.json({ available: false });
        return;
      }

      res.json({
        available: true,
        backup: {
          ...backup,
          size: typeof (backup as any).size === 'bigint' ? (backup as any).size.toString() : (backup as any).size
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/backups ──────────────────────────────────────────────────────
backupsRouter.post(
  '/',
  authorize('admin'),
  validate(createBackupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type } = req.body;
      const firmId = req.user!.firmId!;
      const backupId = await generateSystemBackup(name, type, req.user!.id, firmId);
      const backup = await prisma.backup.findUnique({ where: { id: backupId } });

      res.status(201).json({
        ...backup,
        size: typeof backup?.size === 'bigint' ? backup.size.toString() : backup?.size
      });
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
      const firmId = req.user!.firmId!;
      const backup = await prisma.backup.findFirstOrThrow({
        where: { id: req.params.id as string, firmId },
      });

      if (backup.status !== 'completed' || (!backup.storageKey && !backup.filePath && !backup.cloudUrl)) {
        return res.status(400).json({ error: 'El respaldo no está completado o no tiene archivo' });
      }

      try {
        await prisma.activityLog.create({
          data: {
            firmId,
            userId: req.user!.id,
            activity: 'BACKUP_DOWNLOADED',
            entityType: 'backup',
            entityId: backup.id,
            entityName: backup.name,
            description: 'Descargó respaldo',
            metadata: {
              kind: 'backup_downloaded',
              backupType: backup.type,
              backupId: backup.id,
              backupName: backup.name,
            },
          },
        });
      } catch (logError: any) {
        const isEnumMismatch =
          typeof logError?.message === 'string' &&
          logError.message.includes('Expected ActivityType');
        if (!isEnumMismatch) throw logError;

        // Fallback temporal: cliente Prisma desactualizado en proceso vivo.
        await prisma.activityLog.create({
          data: {
            firmId,
            userId: req.user!.id,
            activity: 'BACKUP_CREATED',
            entityType: 'backup',
            entityId: backup.id,
            entityName: backup.name,
            description: 'Descargó respaldo',
            metadata: {
              kind: 'backup_downloaded',
              backupType: backup.type,
              backupId: backup.id,
              backupName: backup.name,
              fallbackActivity: 'BACKUP_CREATED',
            },
          },
        });
      }

      // Priorizar R2 (storageKey) para respaldos nuevos
      if (backup.storageKey) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="backup_${backup.name}.zip"`);
        const stream = await getStorageProvider().downloadStream(backup.storageKey);
        stream.pipe(res);
        return;
      }

      if (backup.cloudUrl) {
        return res.status(410).json({
          error: 'Este respaldo legacy estaba almacenado en Google Drive y ya no está disponible en este despliegue.',
        });
      }

      // Fallback para respaldos viejos en disco
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        res.download(backup.filePath, path.basename(backup.filePath));
        return;
      }

      return res.status(404).json({ error: 'El archivo del respaldo ya no existe' });
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
      const firmId = req.user!.firmId!;
      const backup = await prisma.backup.findFirstOrThrow({
        where: { id: req.params.id as string, firmId },
        include: { creator: { select: { id: true, name: true } } },
      });

      const progress = activeBackupsProgress.get(backup.id);

      res.json({
        ...backup,
        size: typeof backup.size === 'bigint' ? backup.size.toString() : backup.size,
        progress: progress !== undefined ? progress : undefined
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/backups/:id ────────────────────────────────────────────────
backupsRouter.delete(
  '/:id',
  authorize('admin'),
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = req.user!.firmId!;
      const backup = await prisma.backup.findFirstOrThrow({
        where: { id: req.params.id as string, firmId }
      });

      // Eliminar archivo local si es un respaldo viejo
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }

      await prisma.backup.delete({ where: { id: req.params.id as string } });

      res.json({ message: 'Respaldo eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }
);
