// =============================================================================
// keys.ts — Generadores de object keys para el bucket de almacenamiento
//
// Convención de naming:
//   docs/{groupId}/{documentId}.{ext}
//   versions/{groupId}/{documentId}/v{N}.{ext}
//   pdfs/{groupId}/{documentId}/{pdfId}.pdf
//   backups/{name}.zip
//
// Reglas:
//   · groupId null|undefined → '_ungrouped'
//   · ext siempre sin punto (se limpia automáticamente)
//   · Las keys usan solo caracteres seguros para S3/R2
// =============================================================================

/** Normaliza una extensión: quita el punto inicial si existe. */
function normalizeExt(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}

/**
 * Key del archivo principal de un documento.
 * e.g. "docs/abc-group-id/abc-doc-id.docx"
 */
export function docKey(
  groupId: string | null | undefined,
  docId: string,
  ext: string
): string {
  const prefix = groupId ?? '_ungrouped';
  return `docs/${prefix}/${docId}.${normalizeExt(ext)}`;
}

/**
 * Key del snapshot de una versión específica.
 * e.g. "versions/abc-group-id/abc-doc-id/v3.docx"
 *
 * IMPORTANTE: Esta key es DISTINTA a la del documento principal.
 * Cada versión tiene su propio objeto en el bucket — no comparten referencia.
 */
export function versionKey(
  groupId: string | null | undefined,
  docId: string,
  version: number,
  ext: string
): string {
  const prefix = groupId ?? '_ungrouped';
  return `versions/${prefix}/${docId}/v${version}.${normalizeExt(ext)}`;
}

/**
 * Key de un PDF convertido enlazado a un documento.
 * e.g. "pdfs/abc-group-id/abc-doc-id/abc-pdf-id.pdf"
 */
export function pdfKey(
  groupId: string | null | undefined,
  docId: string,
  pdfId: string
): string {
  const prefix = groupId ?? '_ungrouped';
  return `pdfs/${prefix}/${docId}/${pdfId}.pdf`;
}

/**
 * Key de un archivo de respaldo del sistema.
 * e.g. "backups/2026-04-06_diario_auto.zip"
 */
export function backupKey(name: string): string {
  // Sanitizar nombre: reemplazar espacios y caracteres no seguros
  const safe = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  return `backups/${safe}.zip`;
}
