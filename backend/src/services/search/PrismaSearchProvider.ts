// =============================================================================
// PrismaSearchProvider — Fallback de búsqueda usando Prisma/PostgreSQL
// Sin tolerancia a errores tipográficos. Busca en campos de metadata de la DB.
// Limitación documentada: no busca dentro del contenido de archivos físicos
// ya que ese texto no está almacenado en la base de datos.
// =============================================================================

import prisma from '../../lib/prisma.js';
import type {
  ISearchProvider,
  SearchableDocument,
  SearchResults,
  SearchHit,
  SearchOptions,
  SearchEntityType,
} from './ISearchProvider.js';

export class PrismaSearchProvider implements ISearchProvider {
  async init(): Promise<void> {
    // Prisma no requiere inicialización adicional
    console.log('[PrismaSearch] Proveedor de búsqueda por Prisma activo (sin typo tolerance, sin búsqueda en contenido de archivos).');
  }

  async indexDocument(_doc: SearchableDocument): Promise<void> {
    // Prisma busca directamente en la DB; no hay índice que mantener
  }

  async indexBulk(_docs: SearchableDocument[]): Promise<void> {
    // ídem
  }

  async removeDocument(_id: string, _entityType: SearchEntityType): Promise<void> {
    // ídem
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResults> {
    const { limit = 15, types, firmId } = options;
    const startTime = Date.now();

    if (!query.trim()) {
      return { hits: [], totalHits: 0, processingTimeMs: 0, query };
    }

    const targetTypes: SearchEntityType[] = types?.length ? types : ['document', 'convenio', 'case'];
    const perType = Math.ceil(limit / targetTypes.length) + 2;
    const hits: SearchHit[] = [];

    // ── Documentos ───────────────────────────────────────────────────
    if (targetTypes.includes('document')) {
      try {
        const docs = await prisma.document.findMany({
          where: {
            ...(firmId ? { firmId } : {}),
            isDeleted: false,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: perType,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            tags: true,
            fileStatus: true,
            updatedAt: true,
          },
        });

        for (const doc of docs) {
          hits.push({
            id: doc.id,
            entityType: 'document',
            title: doc.name,
            subtitle: doc.description ?? undefined,
            tags: doc.tags,
            url: `/documento/${doc.id}`,
            meta: { type: doc.type, fileStatus: doc.fileStatus },
            updatedAt: doc.updatedAt.toISOString(),
          });
        }
      } catch (err) {
        console.error('[PrismaSearch] Error buscando documentos:', (err as Error).message);
      }
    }

    // ── Convenios ────────────────────────────────────────────────────
    if (targetTypes.includes('convenio')) {
      try {
        const convenios = await prisma.convenio.findMany({
          where: {
            ...(firmId ? { firmId } : {}),
            OR: [
              { numero: { contains: query, mode: 'insensitive' } },
              { institucion: { contains: query, mode: 'insensitive' } },
              { descripcion: { contains: query, mode: 'insensitive' } },
              { notas: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: perType,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            numero: true,
            institucion: true,
            descripcion: true,
            estado: true,
            updatedAt: true,
          },
        });

        for (const conv of convenios) {
          hits.push({
            id: conv.id,
            entityType: 'convenio',
            title: `${conv.numero} — ${conv.institucion}`,
            subtitle: conv.descripcion ?? undefined,
            url: `/convenios/${conv.id}`,
            meta: { estado: conv.estado },
            updatedAt: conv.updatedAt.toISOString(),
          });
        }
      } catch (err) {
        console.error('[PrismaSearch] Error buscando convenios:', (err as Error).message);
      }
    }

    // ── Casos ────────────────────────────────────────────────────────
    if (targetTypes.includes('case')) {
      try {
        const cases = await prisma.case.findMany({
          where: {
            ...(firmId ? { firmId } : {}),
            OR: [
              { caseNumber: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
              { client: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: perType,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            caseNumber: true,
            title: true,
            client: true,
            description: true,
            status: true,
            updatedAt: true,
          },
        });

        for (const c of cases) {
          hits.push({
            id: c.id,
            entityType: 'case',
            title: `${c.caseNumber} — ${c.title}`,
            subtitle: c.client ?? c.description ?? undefined,
            url: `/expedientes/${c.id}`,
            meta: { status: c.status },
            updatedAt: c.updatedAt.toISOString(),
          });
        }
      } catch (err) {
        console.error('[PrismaSearch] Error buscando casos:', (err as Error).message);
      }
    }

    hits.splice(limit);

    return {
      hits,
      totalHits: hits.length,
      processingTimeMs: Date.now() - startTime,
      query,
    };
  }
}
