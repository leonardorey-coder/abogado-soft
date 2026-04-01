// =============================================================================
// search.routes.ts — Ruta unificada GET /api/search
// Delega al proveedor activo (Meilisearch o Prisma Fallback).
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { getSearchServiceSync } from '../services/search/SearchServiceFactory.js';
import type { SearchEntityType } from '../services/search/ISearchProvider.js';

export const searchRouter = Router();
searchRouter.use(authenticate);

const VALID_TYPES: SearchEntityType[] = ['document', 'convenio', 'case'];

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  types: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = val.split(',').map((t) => t.trim()).filter((t) => VALID_TYPES.includes(t as SearchEntityType));
      return parsed.length > 0 ? (parsed as SearchEntityType[]) : undefined;
    }),
});

// ─── GET /api/search ────────────────────────────────────────────────────────
searchRouter.get(
  '/',
  validateQuery(searchQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, limit, types } = req.query as any;

      const service = getSearchServiceSync();
      if (!service) {
        res.json({ hits: [], totalHits: 0, processingTimeMs: 0, query: q });
        return;
      }

      const results = await service.search(q, { limit, types });
      res.json(results);
    } catch (err) {
      next(err);
    }
  },
);
