// =============================================================================
// downloadHelper.ts — Helper centralizado de descarga con fallback chain
//
// Prioridad:
//   1. R2 (storageKey)      — archivos nuevos post-migración
//   2. Google Drive (driveFileId) — archivos legacy pre-migración-R2
//   3. Disco local (localPath)   — archivos pre-cloud
//
// Centraliza el fallback en UN solo lugar para que cada endpoint
// no reimplemente la lógica (y la olvide).
// =============================================================================

import fs from 'fs';
import path from 'path';
import { getStorageProvider } from './StorageFactory.js';

interface DownloadableDoc {
  storageKey?: string | null;
  driveFileId?: string | null;
  localPath?: string | null;
}

/**
 * Descarga el archivo de un documento/versión/PDF como Buffer.
 *
 * Aplica la cadena de fallback en orden de prioridad:
 *   storageKey (R2) → driveFileId (Drive) → localPath (disco)
 *
 * @throws Error si ninguna fuente está disponible
 */
export async function downloadDocumentBuffer(doc: DownloadableDoc): Promise<Buffer> {
  // 1. R2 — fuente principal post-migración
  if (doc.storageKey) {
    try {
      return await getStorageProvider().download(doc.storageKey);
    } catch (err) {
      console.warn(
        `[downloadHelper] Error descargando desde R2 (key: ${doc.storageKey}):`,
        (err as Error).message
      );
      // Continuar al siguiente fallback
    }
  }

  // 2. Google Drive — archivos legacy pre-migración R2
  if (doc.driveFileId) {
    try {
      const { downloadFile } = await import('../googleDrive.js');
      return await downloadFile(doc.driveFileId);
    } catch (err) {
      console.warn(
        `[downloadHelper] Error descargando desde Drive (id: ${doc.driveFileId}):`,
        (err as Error).message
      );
      // Continuar al siguiente fallback
    }
  }

  // 3. Disco local — archivos pre-cloud (pre-Google Drive)
  if (doc.localPath) {
    const absPath = path.isAbsolute(doc.localPath)
      ? doc.localPath
      : path.resolve(process.cwd(), doc.localPath);

    if (fs.existsSync(absPath)) {
      return fs.readFileSync(absPath);
    }

    console.warn(`[downloadHelper] Archivo local no encontrado en: ${absPath}`);
  }

  throw new Error('Archivo no disponible en ningún almacenamiento configurado (R2, Drive ni disco)');
}

/**
 * Versión del helper que devuelve null en lugar de lanzar excepción.
 * Útil para re-indexación donde un archivo no disponible no debe abortar el proceso.
 */
export async function downloadDocumentBufferSafe(
  doc: DownloadableDoc
): Promise<Buffer | null> {
  try {
    return await downloadDocumentBuffer(doc);
  } catch {
    return null;
  }
}
