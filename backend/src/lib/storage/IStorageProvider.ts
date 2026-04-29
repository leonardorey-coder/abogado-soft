// =============================================================================
// IStorageProvider.ts — Interfaz agnóstica de almacenamiento de objetos
//
// Permite intercambiar el proveedor de almacenamiento (Cloudflare R2, AWS S3,
// MinIO, disco local) mediante una variable de entorno STORAGE_PROVIDER,
// sin modificar la lógica de negocio en routes ni servicios.
//
// Implementaciones disponibles:
//   · R2StorageProvider   — Cloudflare R2 (producción)
//   · LocalStorageProvider — Disco local (desarrollo / testing)
// =============================================================================

import type { Readable } from 'stream';

/** Resultado estándar de cualquier operación de escritura. */
export interface UploadResult {
  /** Clave única del objeto (e.g. "docs/uuid-group/uuid-doc.docx"). */
  storageKey: string;
  /** URL pública o null si el bucket no es público. */
  url: string | null;
  /** ETag del objeto (equivalente a driveRevisionId para auditoría). */
  etag: string | null;
}

export interface IStorageProvider {
  /**
   * Sube un buffer como nuevo objeto.
   * Si ya existe un objeto con esa key, lo sobreescribe.
   */
  upload(key: string, content: Buffer, mimeType: string): Promise<UploadResult>;

  /**
   * Actualiza el contenido de un objeto existente.
   * Semánticamente igual a upload() — separados para claridad en code reviews.
   */
  update(key: string, content: Buffer, mimeType: string): Promise<UploadResult>;

  /**
   * Sube un objeto desde un Readable stream.
   * Usar para archivos grandes (backups) donde cargar todo en RAM causaría OOM.
   * contentLength es obligatorio para R2/S3 — sin él la petición puede fallar.
   */
  uploadStream(
    key: string,
    stream: Readable,
    mimeType: string,
    contentLength?: number
  ): Promise<UploadResult>;

  /** Descarga un objeto completo como Buffer en memoria. */
  download(key: string): Promise<Buffer>;

  /** Descarga un objeto como Readable stream (para proxy sin cargar en RAM). */
  downloadStream(key: string): Promise<Readable>;

  /** Elimina un objeto. No lanza si el objeto no existe. */
  delete(key: string): Promise<void>;

  /**
   * Genera una URL firmada de lectura (tiempo limitado).
   * Después de expiresInSeconds la URL deja de funcionar.
   * @default expiresInSeconds 900 (15 min)
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Genera una URL firmada de escritura para upload directo desde el cliente.
   * R2/S3: devuelve presigned PUT URL — NO crea ningún objeto en el bucket.
   * El frontend hace PUT a esa URL y luego llama a POST /api/storage/complete-upload.
   * @default expiresInSeconds 900 (15 min)
   */
  getSignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds?: number
  ): Promise<string>;

  /**
   * Copia un objeto a otra key dentro del mismo bucket.
   * Usado para snapshots de versiones: copy(docKey → versionKey) antes de update(docKey).
   * Más eficiente que download+upload porque no transfiere bytes al servidor.
   */
  copy(sourceKey: string, destinationKey: string): Promise<UploadResult>;

  /**
   * Verifica que el servicio esté disponible y las credenciales sean válidas.
   * Retorna true si OK, false si no — nunca lanza excepción.
   */
  healthCheck(): Promise<boolean>;
}
