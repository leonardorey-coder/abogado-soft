/**
 * captureDocumentAsPdf
 * ---------------------
 * Genera un PDF 100% fiel a lo que SuperDoc renderiza en pantalla.
 *
 * Optimización de Bordes:
 * - Se usa `toPng` en lugar de `toCanvas` para evitar artefactos JPEG.
 * - PNG es lossless, lo que preserva la delgadez original de las líneas (1px).
 * - Se mantiene escala 2x para nitidez de texto, pero sin distorsión de bordes.
 */

import { toPng } from 'html-to-image';

const SCALE = 2; // 2x para nitidez (Retina)
const PX_TO_PT = 72 / 96; // 0.75 conversión estándar

export async function captureDocumentAsPdf(mountEl: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  // 1. Buscar las páginas individuales de SuperDoc
  const pageEls = Array.from(
    mountEl.querySelectorAll<HTMLElement>('.superdoc-page'),
  );

  if (pageEls.length === 0) {
    throw new Error('No se encontraron páginas del documento para capturar.');
  }

  // Dimensiones de la primera página
  const firstRect = pageEls[0].getBoundingClientRect();
  const pageWPt = firstRect.width * PX_TO_PT;
  const pageHPt = firstRect.height * PX_TO_PT;

  const pdf = new jsPDF({
    orientation: pageWPt > pageHPt ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWPt, pageHPt],
    compress: true, // Comprimir el PDF final
  });

  for (let i = 0; i < pageEls.length; i++) {
    const pageEl = pageEls[i];

    if (i > 0) {
      const rect = pageEl.getBoundingClientRect();
      const w = rect.width * PX_TO_PT;
      const h = rect.height * PX_TO_PT;
      pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
    }

    // Usar toPng para máxima fidelidad en líneas y bordes
    const dataUrl = await toPng(pageEl, {
      pixelRatio: SCALE,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Inyectar estilos para asegurar que no haya sombras ni efectos raros
      style: {
        boxShadow: 'none',
        outline: 'none',
        WebkitFontSmoothing: 'antialiased',
      } as Partial<CSSStyleDeclaration>
    });

    const rect = pageEl.getBoundingClientRect();
    const wPt = rect.width * PX_TO_PT;
    const hPt = rect.height * PX_TO_PT;

    // IMPORTANTE: Usar formato 'PNG' y compresión 'FAST' o 'SLOW' para evitar ruido
    pdf.addImage(dataUrl, 'PNG', 0, 0, wPt, hPt, undefined, 'FAST');
  }

  return pdf.output('blob');
}
