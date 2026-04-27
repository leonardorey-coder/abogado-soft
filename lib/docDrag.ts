import type React from "react";

export const DOC_DRAG_MIME = "application/x-abogado-doc";
export const DOC_DRAG_START_EVENT = "abogado:doc-drag-start";
export const DOC_DRAG_END_EVENT = "abogado:doc-drag-end";

export interface DocDragData {
  __abogadosoft_doc: true;
  documentId: string;
  documentName: string;
  documentType: string;
}

export function startDocDrag(
  e: React.DragEvent,
  doc: { id: string; name: string; type?: string },
) {
  const payload: DocDragData = {
    __abogadosoft_doc: true,
    documentId: doc.id,
    documentName: doc.name,
    documentType: doc.type ?? "DOCX",
  };
  const json = JSON.stringify(payload);
  try {
    e.dataTransfer.setData(DOC_DRAG_MIME, json);
    e.dataTransfer.setData("text/plain", json);
    e.dataTransfer.effectAllowed = "link";
  } catch {
    // noop
  }
  window.dispatchEvent(new CustomEvent(DOC_DRAG_START_EVENT));
}

export function endDocDrag() {
  window.dispatchEvent(new CustomEvent(DOC_DRAG_END_EVENT));
}
