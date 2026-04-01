// =============================================================================
// textExtractor — Extrae texto plano de archivos para indexación en búsqueda
// Reutiliza mammoth (DOCX) y pdf-parse (PDF) ya instalados en el backend.
// =============================================================================

import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

/** Tamaño máximo del textContent indexado: 500 KB */
const MAX_TEXT_BYTES = 500 * 1024;

/**
 * Extrae el texto plano de un archivo según su extensión.
 * Nunca lanza excepción: en caso de error retorna ''.
 *
 * Formatos soportados:
 *   .docx / .doc  → mammoth.extractRawText()
 *   .pdf          → pdf-parse
 *   .txt / .rtf   → fs.readFileSync (UTF-8)
 *   otros         → '' (silencioso)
 */
export async function extractTextFromFile(localPath: string | null | undefined): Promise<string> {
  if (!localPath) return '';

  // Resolver ruta relativa al cwd del proceso (carpeta backend/)
  const resolvedPath = path.isAbsolute(localPath)
    ? localPath
    : path.resolve(process.cwd(), localPath);

  if (!fs.existsSync(resolvedPath)) return '';

  const ext = path.extname(resolvedPath).toLowerCase();

  try {
    let text = '';

    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: resolvedPath });
      text = result.value ?? '';
    } else if (ext === '.pdf') {
      const buffer = fs.readFileSync(resolvedPath);
      const data = await pdfParse(buffer);
      text = data.text ?? '';
    } else if (ext === '.txt' || ext === '.rtf') {
      text = fs.readFileSync(resolvedPath, 'utf-8');
    } else {
      // Formato no soportado (xlsx, imágenes, etc.)
      return '';
    }

    // Truncar a MAX_TEXT_BYTES para no sobrecargar el índice
    if (Buffer.byteLength(text, 'utf-8') > MAX_TEXT_BYTES) {
      // Cortar por caracteres hasta aproximar el límite en bytes
      text = text.slice(0, Math.floor(MAX_TEXT_BYTES / 3));
    }

    return text.trim();
  } catch (err) {
    console.warn(`[textExtractor] No se pudo extraer texto de "${resolvedPath}":`, (err as Error).message);
    return '';
  }
}
