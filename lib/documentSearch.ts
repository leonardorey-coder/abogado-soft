import type { Document } from "../types";

export function matchesSearch(doc: Document, q: string): boolean {
  if (!q.trim()) return true;
  const term = q.trim().toLowerCase();
  return (
    doc.name.toLowerCase().includes(term) ||
    (doc.type && doc.type.toLowerCase().includes(term))
  );
}
