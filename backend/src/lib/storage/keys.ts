// =============================================================================
// keys.ts — Generadores de object keys para el bucket de almacenamiento
//
// Convención de naming:
//   docs/{firmId}/{groupId}/{documentId}.{ext}
//   versions/{firmId}/{groupId}/{documentId}/v{N}.{ext}
//   pdfs/{firmId}/{groupId}/{documentId}/{pdfId}.pdf
//   backups/{firmId}/{name}.zip
//
// Reglas:
//   · firmId null|undefined → '_nofirm'  (datos pre-migración)
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
 * e.g. "docs/firm-uuid/abc-group-id/abc-doc-id.docx"
 */
export function docKey(
  firmId: string | null | undefined,
  groupId: string | null | undefined,
  docId: string,
  ext: string
): string {
  const firm = firmId ?? '_nofirm';
  const group = groupId ?? '_ungrouped';
  return `docs/${firm}/${group}/${docId}.${normalizeExt(ext)}`;
}

/**
 * Key del snapshot de una versión específica.
 * e.g. "versions/firm-uuid/abc-group-id/abc-doc-id/v3.docx"
 *
 * IMPORTANTE: Esta key es DISTINTA a la del documento principal.
 * Cada versión tiene su propio objeto en el bucket — no comparten referencia.
 */
export function versionKey(
  firmId: string | null | undefined,
  groupId: string | null | undefined,
  docId: string,
  version: number,
  ext: string
): string {
  const firm = firmId ?? '_nofirm';
  const group = groupId ?? '_ungrouped';
  return `versions/${firm}/${group}/${docId}/v${version}.${normalizeExt(ext)}`;
}

/**
 * Key de un PDF convertido enlazado a un documento.
 * e.g. "pdfs/firm-uuid/abc-group-id/abc-doc-id/abc-pdf-id.pdf"
 */
export function pdfKey(
  firmId: string | null | undefined,
  groupId: string | null | undefined,
  docId: string,
  pdfId: string
): string {
  const firm = firmId ?? '_nofirm';
  const group = groupId ?? '_ungrouped';
  return `pdfs/${firm}/${group}/${docId}/${pdfId}.pdf`;
}

/**
 * Key de un archivo de respaldo del sistema.
 * e.g. "backups/firm-uuid/2026-04-06_diario_auto.zip"
 */
export function backupKey(firmId: string | null | undefined, name: string): string {
  const firm = firmId ?? '_nofirm';
  // Sanitizar nombre: reemplazar espacios y caracteres no seguros
  const safe = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  return `backups/${firm}/${safe}.zip`;
}
