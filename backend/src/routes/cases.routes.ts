import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, uuidParam, paginationQuery } from '../middleware/validate.js';

export const casesRouter = Router();
casesRouter.use(authenticate);

const createCaseSchema = z.object({
  caseNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  client: z.string().max(255).optional(),
  court: z.string().max(255).optional(),
  caseType: z.string().max(100).optional(),
  status: z.enum(['en_proceso', 'resuelto', 'archivado', 'apelacion', 'pendiente']).default('en_proceso'),
  description: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

const updateCaseSchema = createCaseSchema.partial();

const casesQuerySchema = paginationQuery.extend({
  status: z.enum(['en_proceso', 'resuelto', 'archivado', 'apelacion', 'pendiente']).optional(),
  search: z.string().optional(),
  caseType: z.string().optional(),
});

// ─── GET /api/cases ─────────────────────────────────────────────────────────
casesRouter.get(
  '/',
  validateQuery(casesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortOrder, status, search, caseType } = req.query as any;
      const skip = (page - 1) * limit;
      const where: any = {};

      if (status) where.status = status;
      if (caseType) where.caseType = { contains: caseType, mode: 'insensitive' };
      if (search) {
        where.OR = [
          { caseNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { client: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [cases, total] = await Promise.all([
        prisma.case.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: sortOrder },
          include: {
            responsible: { select: { id: true, name: true } },
            _count: { select: { documents: true, caseDocuments: true } },
          },
        }),
        prisma.case.count({ where }),
      ]);

      res.json({ data: cases, total, page, limit });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/cases/:id ─────────────────────────────────────────────────────
casesRouter.get(
  '/:id',
  validateParams(uuidParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const case_ = await prisma.case.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          responsible: { select: { id: true, name: true, email: true } },
          documents: { select: { id: true, name: true, type: true, fileStatus: true, updatedAt: true } },
          caseDocuments: {
            include: {
              document: { select: { id: true, name: true, type: true, fileStatus: true } },
            },
          },
        },
      });
      res.json(case_);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/cases ────────────────────────────────────────────────────────
casesRouter.post(
  '/',
  authorize('admin'),
  validate(createCaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const case_ = await prisma.case.create({
        data: {
          ...data,
          responsibleId: req.user!.id,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CASE_CREATED',
          entityType: 'case',
          entityId: case_.id,
          entityName: `${case_.caseNumber} - ${case_.title}`,
          description: `Expediente creado: ${case_.caseNumber}`,
        },
      });

      res.status(201).json(case_);
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/cases/:id ───────────────────────────────────────────────────
casesRouter.patch(
  '/:id',
  authorize('admin'),
  validateParams(uuidParam),
  validate(updateCaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);

      const case_ = await prisma.case.update({
        where: { id: req.params.id },
        data,
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CASE_UPDATED',
          entityType: 'case',
          entityId: case_.id,
          entityName: case_.caseNumber,
        },
      });

      res.json(case_);
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/cases/:id/documents ──────────────────────────────────────────
const linkDocSchema = z.object({
  documentId: z.string().uuid(),
});

casesRouter.post(
  '/:id/documents',
  validateParams(uuidParam),
  validate(linkDocSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const link = await prisma.caseDocument.create({
        data: {
          caseId: req.params.id,
          documentId: req.body.documentId,
          addedBy: req.user!.id,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CASE_DOCUMENT_LINKED',
          entityType: 'case',
          entityId: req.params.id,
          description: `Documento vinculado al expediente`,
        },
      });

      res.status(201).json(link);
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/cases/:caseId/documents/:docId ─────────────────────────────
casesRouter.delete(
  '/:id/documents/:docId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.caseDocument.delete({
        where: {
          caseId_documentId: {
            caseId: req.params.id,
            documentId: req.params.docId,
          },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          activity: 'CASE_DOCUMENT_UNLINKED',
          entityType: 'case',
          entityId: req.params.id,
        },
      });

      res.json({ message: 'Documento desvinculado del expediente' });
    } catch (error) {
      next(error);
    }
  },
);
