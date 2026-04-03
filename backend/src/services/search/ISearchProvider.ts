// =============================================================================
// ISearchProvider — Contrato genérico para cualquier motor de búsqueda
// Permite intercambiar Meilisearch, Prisma, Typesense, etc. sin tocar
// la lógica de negocio: solo cambia SEARCH_ENGINE en .env
// =============================================================================

export type SearchEntityType = 'document' | 'convenio' | 'case';

/** Documento que enviamos al índice (independiente del motor) */
export interface SearchableDocument {
  /** ID único del registro (UUID de Prisma) */
  id: string;
  entityType: SearchEntityType;
  /** Texto principal para el ranking (nombre, numero, título) */
  title: string;
  /** Subtítulo / descripción corta */
  subtitle?: string;
  /** Tags / palabras clave adicionales */
  tags?: string[];
  /** Contenido de texto plano extraído del archivo (.docx / .pdf / .txt) */
  textContent?: string;
  /** Ruta relativa para navegar al recurso en el frontend */
  url: string;
  /** Metadatos extras según tipo (estado, tipo de archivo, etc.) */
  meta?: Record<string, unknown>;
  /** Fecha de creación del registro */
  createdAt?: string;
  updatedAt?: string;
}

/** Un resultado devuelto al frontend (sin textContent para no inflar la respuesta) */
export interface SearchHit {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  tags?: string[];
  /** Fragmento del contenido del documento con el término resaltado con <mark> (solo Meilisearch) */
  contentSnippet?: string;
  url: string;
  meta?: Record<string, unknown>;
  /** Fecha de creación del registro */
  createdAt?: string;
  updatedAt?: string;
  /** Fragmentos con el término resaltado (opcional, solo Meilisearch) */
  highlight?: string;
}

export interface SearchResults {
  hits: SearchHit[];
  totalHits: number;
  processingTimeMs: number;
  query: string;
}

export interface SearchOptions {
  limit?: number;
  /** Filtrar por tipos de entidad ('document' | 'convenio' | 'case') */
  types?: SearchEntityType[];
}

/** Interfaz que todo adaptador de búsqueda debe implementar */
export interface ISearchProvider {
  /**
   * Inicializa el proveedor (crea índices, configura atributos, etc.)
   * Se llama una sola vez al arrancar el servidor.
   */
  init(): Promise<void>;

  /**
   * Indexa o actualiza un documento individual.
   * Fire-and-forget desde los hooks de las rutas.
   */
  indexDocument(doc: SearchableDocument): Promise<void>;

  /**
   * Indexa múltiples documentos en batch (para el script de re-indexación).
   */
  indexBulk(docs: SearchableDocument[]): Promise<void>;

  /**
   * Elimina un documento del índice por su ID y tipo.
   */
  removeDocument(id: string, entityType: SearchEntityType): Promise<void>;

  /**
   * Realiza la búsqueda y retorna resultados agrupados.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResults>;
}
