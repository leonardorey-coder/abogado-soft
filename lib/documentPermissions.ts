import type { Document, DocumentPermissionLevel } from "../types";

export function hasWritePermission(permission: DocumentPermissionLevel | undefined): boolean {
  const level = permission ?? "none";
  return level === "write" || level === "admin";
}

export function canChangeDocumentFileStatus(
  doc: Pick<Document, "currentUserPermission" | "ownerId">,
  userId: string | undefined,
): boolean {
  if (hasWritePermission(doc.currentUserPermission)) return true;
  if (userId && doc.ownerId && doc.ownerId === userId) return true;
  return false;
}
