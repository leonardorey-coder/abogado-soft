import type { Document } from "../types";

export type DocumentSyncVisual = "completed" | "syncing" | "failed" | "none";

export function documentSyncVisual(doc: Document): DocumentSyncVisual {
  if (doc.syncStatus === "failed") return "failed";
  if (doc.syncStatus === "syncing") return "syncing";
  if (doc.syncStatus === "completed") return "completed";
  if (doc.driveFileId && doc.lastSyncAt) return "completed";
  return "none";
}
