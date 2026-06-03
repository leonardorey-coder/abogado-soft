// ============================================================================
// Hook useDocuments — Gestiona el estado de documentos con la API real
// Reemplaza el uso de initialDocuments mock en App.tsx y Dashboard
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { documentsApi, type ApiDocument } from './api';
import type { Document, FileStatus, CollaborationStatus, SharingStatus, DocumentPermissionLevel, DocumentPermissionOrigin, DocumentShare, ShareMethod } from '../types';

// ─── Transformador: ApiDocument → Document (tipo del frontend) ──────────

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffWeeks < 4) return `Hace ${diffWeeks} sem`;
  if (diffMonths < 12) return `Hace ${diffMonths} meses`;
  return `Hace más de 1 año`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return `Hace ${Math.max(1, Math.floor(diffMs / 60000))} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 1) {
    return `Ayer, ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeSyncStatus(raw: string | undefined | null): Document['syncStatus'] | undefined {
  if (!raw) return undefined;
  const s = String(raw).toLowerCase();
  if (s === 'pending' || s === 'syncing' || s === 'completed' || s === 'failed') return s;
  return undefined;
}

export function apiDocToFrontend(doc: ApiDocument): Document {
  const typeMap: Record<string, Document['type']> = {
    docx: 'DOCX', doc: 'DOCX', pdf: 'PDF', xlsx: 'XLSX', xls: 'XLSX', txt: 'DOCX', rtf: 'DOCX',
  };

  const permissions = doc.permissions?.map(p => ({
    userName: p.user?.name ?? p.group?.name ?? 'Desconocido',
    level: p.permissionLevel as DocumentPermissionLevel,
  }));

  return {
    id: doc.id,
    name: doc.name,
    type: typeMap[doc.type.toLowerCase()] ?? 'PDF',
    lastModified: formatDate(doc.updatedAt),
    timeAgo: formatTimeAgo(doc.updatedAt),
    fileStatus: (doc.fileStatus as FileStatus) ?? 'ACTIVO',
    collaborationStatus: doc.collaborationStatus as CollaborationStatus | undefined,
    sharingStatus: doc.sharingStatus as SharingStatus | undefined,
    expirationDate: doc.expirationDate
      ? new Date(doc.expirationDate).toLocaleDateString('es-MX')
      : undefined,
    expirationDateRaw: doc.expirationDate ?? undefined,
    documentPermissions: permissions,
    currentUserPermission: doc.effectivePermission as DocumentPermissionLevel | undefined,
    currentUserPermissionOrigin: doc.effectivePermissionOrigin as DocumentPermissionOrigin | undefined,
    ownerId: doc.ownerId ?? undefined,
    lastEditor: doc.owner?.name ?? 'Juan Pérez', // Default mock if owner not found
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    storageKey: doc.storageKey ?? null,
    localPath: doc.localPath ?? null,
    syncStatus: normalizeSyncStatus(doc.syncStatus),
    driveFileId: doc.driveFileId ?? null,
    lastSyncAt: doc.lastSyncAt ?? null,
    assignments: doc.assignments?.map(a => ({
      id: a.id,
      status: a.status,
      assignee: {
        id: a.assignee.id,
        name: a.assignee.name,
        email: a.assignee.email,
        avatarUrl: (a.assignee as any).avatarUrl,
      }
    })),
    recentShares: doc.recentShares?.map(s => ({
      sharedWith: s.sharedWith,
      shareMethod: s.shareMethod as ShareMethod,
      sharedAt: s.sharedAt,
      sharedBy: s.sharedBy,
    })) as DocumentShare[] | undefined,
  };
}

// ─── Hook principal ─────────────────────────────────────────────────────

interface UseDocumentsOptions {
  autoFetch?: boolean;
  search?: string;
  type?: string;
  fileStatus?: string;
  limit?: number;
  from?: string;
  to?: string;
  /** Called after a successful delete with the deleted doc id and name */
  onDeleted?: (id: string, name: string) => void;
}

interface UseDocumentsReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
  deleteDocument: (id: string, docName?: string) => Promise<void>;
  restoreDocument: (id: string) => Promise<void>;
  updateStatus: (id: string, status: FileStatus) => Promise<void>;
  createDocument: (data: { name: string; type: string; description?: string }) => Promise<Document | null>;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const { autoFetch = true, search, type, fileStatus, limit = 20, from, to, onDeleted } = options;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await documentsApi.list({
        page,
        limit,
        search: search || undefined,
        type: type || undefined,
        fileStatus: fileStatus || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      const frontendDocs = res.data.map(apiDocToFrontend);
      setDocuments(frontendDocs);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cargando documentos';
      setError(msg);
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, type, fileStatus, from, to]);

  useEffect(() => {
    if (autoFetch) {
      fetchDocuments();
    }
  }, [autoFetch, fetchDocuments]);

  const deleteDocument = useCallback(async (id: string, docName?: string) => {
    try {
      await documentsApi.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setTotal(prev => prev - 1);
      onDeleted?.(id, docName ?? '');
    } catch (err) {
      console.error('Error deleting document:', err);
      throw err;
    }
  }, [onDeleted]);

  const restoreDocument = useCallback(async (id: string) => {
    try {
      await documentsApi.restore(id);
      // Refrescar después de restaurar
      await fetchDocuments();
    } catch (err) {
      console.error('Error restoring document:', err);
      throw err;
    }
  }, [fetchDocuments]);

  const updateStatus = useCallback(async (id: string, status: FileStatus) => {
    let previous: FileStatus | undefined;
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc) previous = doc.fileStatus;
      return prev.map((d) => (d.id === id ? { ...d, fileStatus: status } : d));
    });
    try {
      await documentsApi.update(id, { fileStatus: status });
    } catch (err) {
      console.error('Error updating status:', err);
      if (previous !== undefined) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, fileStatus: previous! } : d)),
        );
      }
      throw err;
    }
  }, []);

  const createDocument = useCallback(async (data: { name: string; type: string; description?: string }) => {
    try {
      const res = await documentsApi.create(data);
      const doc = apiDocToFrontend(res);
      setDocuments(prev => [doc, ...prev]);
      setTotal(prev => prev + 1);
      return doc;
    } catch (err) {
      console.error('Error creating document:', err);
      throw err;
    }
  }, []);

  return {
    documents,
    loading,
    error,
    total,
    page,
    totalPages,
    setPage,
    refresh: fetchDocuments,
    deleteDocument,
    restoreDocument,
    updateStatus,
    createDocument,
  };
}

// ─── Hook para papelera ─────────────────────────────────────────────────

export function useTrash() {
  const [deletedDocuments, setDeletedDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await documentsApi.listTrash();
      setDeletedDocuments(res.map(apiDocToFrontend));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cargando papelera';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const restoreDocument = useCallback(async (id: string) => {
    try {
      await documentsApi.restore(id);
      setDeletedDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error restoring:', err);
      throw err;
    }
  }, []);

  return {
    deletedDocuments,
    loading,
    error,
    refresh: fetchTrash,
    restoreDocument,
  };
}
