import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { uploadFileStream, downloadFileStream, deleteFile } from '../lib/googleDrive';
import {
  generateSystemBackup,
  activeBackupsProgress
} from '../lib/backupService.js';

export const backupsRouter = Router();
backupsRouter.use(authenticate);
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
          cloudUrl: { not: null },
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
      const backupId = await generateSystemBackup(name, type, req.user!.id);
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
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id },
      });

      if (backup.status !== 'completed' || (!backup.filePath && !backup.cloudUrl)) {
        return res.status(400).json({ error: 'El respaldo no está completado o no tiene archivo' });
      }

      // Si tiene archivo en Drive, lo streameamos directo
      if (backup.cloudUrl) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="backup_${backup.name}.zip"`);
        const stream = await downloadFileStream(backup.cloudUrl);
        stream.pipe(res);
        return;
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
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id },
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
      const backup = await prisma.backup.findUniqueOrThrow({
        where: { id: req.params.id }
      });

      // Eliminar de Drive si existe
      if (backup.cloudUrl) {
        try {
          await deleteFile(backup.cloudUrl);
        } catch (e) {
          console.error('No se pudo borrar el archivo de Drive', e);
        }
      }

      // Eliminar archivo local si es un respaldo viejo
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
