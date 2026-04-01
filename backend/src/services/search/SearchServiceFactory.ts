// =============================================================================
// SearchServiceFactory — Singleton del proveedor de búsqueda activo
//
// Para cambiar de motor, editar .env:
//   SEARCH_ENGINE=meilisearch   ← Meilisearch self-hosted (Docker/Colima)
//   SEARCH_ENGINE=prisma        ← Fallback Prisma/PostgreSQL (sin dependencias externas)
//
// El resto del código nunca importa MeiliSearch ni PrismaSearchProvider
// directamente: solo usa `searchService` de este módulo.
// =============================================================================

import type { ISearchProvider } from './ISearchProvider.js';

let instance: ISearchProvider | null = null;

export async function getSearchService(): Promise<ISearchProvider> {
  if (instance) return instance;

  const engine = (process.env.SEARCH_ENGINE ?? 'prisma').toLowerCase();

  if (engine === 'meilisearch') {
    const { MeiliSearchProvider } = await import('./MeiliSearchProvider.js');
    instance = new MeiliSearchProvider();
  } else {
    const { PrismaSearchProvider } = await import('./PrismaSearchProvider.js');
    instance = new PrismaSearchProvider();
  }

  await instance.init();
  return instance;
}

/**
 * Retorna el singleton ya inicializado.
 * Solo usar DESPUÉS de que `getSearchService()` fue llamado al arrancar el servidor.
 * En los hooks fire-and-forget de las rutas, usar este método para evitar await.
 */
export function getSearchServiceSync(): ISearchProvider | null {
  return instance;
}
