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

function configuredLocalRoots(): string[] {
  const envRoots = [
    process.env.LEGACY_UPLOADS_PATH,
    process.env.LOCAL_STORAGE_PATH,
  ].flatMap((value) => value?.split(path.delimiter).filter(Boolean) ?? []);

  return [
    ...envRoots,
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'local-storage'),
  ].map((root) => path.resolve(root));
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveSafeLocalPath(localPath: string | null | undefined): string | null {
  if (!localPath) return null;

  const absPath = path.isAbsolute(localPath)
    ? path.resolve(localPath)
    : path.resolve(process.cwd(), localPath);

  return configuredLocalRoots().some((root) => isWithinRoot(root, absPath)) ? absPath : null;
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
    const absPath = resolveSafeLocalPath(doc.localPath);

    if (!absPath) {
      console.warn(`[downloadHelper] Ruta local fuera de directorios permitidos: ${doc.localPath}`);
    } else if (fs.existsSync(absPath)) {
      return fs.readFileSync(absPath);
    } else {
      console.warn(`[downloadHelper] Archivo local no encontrado en: ${absPath}`);
    }

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
