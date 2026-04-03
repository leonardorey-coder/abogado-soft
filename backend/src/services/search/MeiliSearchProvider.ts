// =============================================================================
// MeiliSearchProvider — Adaptador Meilisearch para ISearchProvider
// Self-hosted vía Docker (docker compose up -d meilisearch).
// Compatible con cualquier entorno Docker (Colima, Docker Desktop, Podman, etc.)
// =============================================================================

import { MeiliSearch, Index } from 'meilisearch';
import type {
  ISearchProvider,
  SearchableDocument,
  SearchResults,
  SearchHit,
  SearchOptions,
  SearchEntityType,
} from './ISearchProvider.js';

const INDEX_NAMES: SearchEntityType[] = ['document', 'convenio', 'case'];

// Atributos que se usan para hacer matching (incluye textContent)
const SEARCHABLE_ATTRIBUTES = ['title', 'subtitle', 'tags', 'textContent'];

// Atributos que se devuelven en los resultados
// IMPORTANTE: textContent debe estar aquí para que Meilisearch lo incluya en _formatted
// (aunque no lo devolvamos al cliente directamente, la versión _formatted sí la usamos para el snippet)
const ATTRIBUTES_TO_RETRIEVE = ['id', 'entityType', 'title', 'subtitle', 'tags', 'url', 'meta', 'createdAt', 'updatedAt', 'textContent'];

// Atributos filterable (para filtrar por entityType)
const FILTERABLE_ATTRIBUTES = ['entityType'];

export class MeiliSearchProvider implements ISearchProvider {
  private client: MeiliSearch;
  private initialized = false;

  constructor() {
    this.client = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_KEY || '',
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Verificar conectividad primero
      await this.client.health();

      // Crear / actualizar configuración de cada índice
      for (const indexName of INDEX_NAMES) {
        // createIndex es idempotente si ya existe
        await this.client.createIndex(indexName, { primaryKey: 'id' });

        const index: Index = this.client.index(indexName);

        // Configurar atributos en paralelo
        await Promise.all([
          index.updateSearchableAttributes(SEARCHABLE_ATTRIBUTES),
          index.updateFilterableAttributes(FILTERABLE_ATTRIBUTES),
          index.updateDisplayedAttributes(['*']),  // Permitir todos para que _formatted incluya textContent
          index.updateTypoTolerance({
            enabled: true,
            minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
          }),
          index.updateRankingRules(['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']),
        ]);
      }

      this.initialized = true;
      console.log('[MeiliSearch] Inicializado correctamente con índices:', INDEX_NAMES.join(', '));
    } catch (err) {
      console.warn(
        '[MeiliSearch] No se pudo conectar al motor. El buscador estará en modo degradado (Prisma fallback).',
        (err as Error).message,
      );
    }
  }

  async indexDocument(doc: SearchableDocument): Promise<void> {
    try {
      const index = this.client.index(doc.entityType);
      await index.addDocuments([doc]);
    } catch (err) {
      console.warn(`[MeiliSearch] Error indexando documento ${doc.id}:`, (err as Error).message);
    }
  }

  async indexBulk(docs: SearchableDocument[]): Promise<void> {
    if (docs.length === 0) return;

    // Agrupar por entityType para usar el índice correcto
    const byType = new Map<SearchEntityType, SearchableDocument[]>();
    for (const doc of docs) {
      if (!byType.has(doc.entityType)) byType.set(doc.entityType, []);
      byType.get(doc.entityType)!.push(doc);
    }

    // Indexar por lotes de 100 por tipo
    const BATCH_SIZE = 100;
    for (const [entityType, typeDocs] of byType.entries()) {
      const index = this.client.index(entityType);
      for (let i = 0; i < typeDocs.length; i += BATCH_SIZE) {
        const batch = typeDocs.slice(i, i + BATCH_SIZE);
        try {
          await index.addDocuments(batch);
        } catch (err) {
          console.warn(`[MeiliSearch] Error indexando batch ${entityType}[${i}]:`, (err as Error).message);
        }
      }
    }
  }

  async removeDocument(id: string, entityType: SearchEntityType): Promise<void> {
    try {
      const index = this.client.index(entityType);
      await index.deleteDocument(id);
    } catch (err) {
      console.warn(`[MeiliSearch] Error eliminando documento ${id}:`, (err as Error).message);
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResults> {
    const { limit = 15, types } = options;
    const startTime = Date.now();

    if (!query.trim()) {
      return { hits: [], totalHits: 0, processingTimeMs: 0, query };
    }

    // Si se filtra por tipos, solo buscar en esos índices; si no, en todos
    const targetIndexes: SearchEntityType[] = types?.length ? types : INDEX_NAMES;

    // Búsqueda en múltiples índices usando multiSearch
    const searches = targetIndexes.map((indexName) => ({
      indexUid: indexName,
      q: query,
      limit: Math.ceil(limit / targetIndexes.length) + 2, // distribuir entre índices
      attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
      attributesToHighlight: ['title', 'subtitle', 'textContent'],
      attributesToCrop: ['textContent'],
      cropLength: 20,        // 20 palabras de contexto alrededor del match
      cropMarker: '…',
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    }));

    try {
      const { results } = await this.client.multiSearch({ queries: searches });

      const hits: SearchHit[] = [];
      let totalHits = 0;

      for (const result of results) {
        totalHits += result.estimatedTotalHits ?? result.hits?.length ?? 0;
        for (const hit of result.hits ?? []) {
          hits.push({
            id: hit.id,
            entityType: hit.entityType as SearchEntityType,
            title: hit._formatted?.title ?? hit.title,
            subtitle: hit._formatted?.subtitle ?? hit.subtitle,
            tags: hit.tags,
            url: hit.url,
            meta: hit.meta,
            createdAt: hit.createdAt,
            updatedAt: hit.updatedAt,
            highlight: hit._formatted?.title ?? undefined,
            // Snippet del contenido: solo si el textContent formateado difiere del original
            // (indica que hay un <mark> → hubo match en el contenido del archivo)
            contentSnippet: (() => {
              const formatted = hit._formatted?.textContent;
              const original = hit.textContent;
              if (!formatted) return undefined;
              // Meilisearch solo formatea si hay coincidencia; si son iguales, no hubo match
              if (typeof formatted === 'string' && formatted.includes('<mark>')) {
                return formatted;
              }
              return undefined;
            })(),
          });
        }
      }

      // Ordenar por relevancia (Meilisearch ya los ordena, pero mezclamos múltiples índices)
      hits.splice(limit); // respetar el límite total

      return {
        hits,
        totalHits,
        processingTimeMs: Date.now() - startTime,
        query,
      };
    } catch (err) {
      console.error('[MeiliSearch] Error en búsqueda:', (err as Error).message);
      return { hits: [], totalHits: 0, processingTimeMs: Date.now() - startTime, query };
    }
  }
}
