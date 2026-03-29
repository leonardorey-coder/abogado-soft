import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, FileStatus, ShareMethod, DocumentPermissionLevel } from "../types";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { useDocuments } from "../lib/useDocuments";
import {
  documentsApi,
  assignmentsApi,
  recentlyOpenedApi,
  type ApiDocumentAssignment,
  type RecentlyOpenedItem,
} from "../lib/api";
import { useFileDragDrop } from "../lib/useFileDragDrop";
import { getDocumentRoute } from "../lib/routes";
import { documentSyncVisual } from "../lib/documentSyncUi";
import { buildDocumentActionMenuItems } from "../lib/documentActionMenu";
import type { AppLayoutOutletContext } from "./AppLayout";
import { ShareModal } from "./ShareModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { AssignModal } from "./AssignModal";
import {
  ActionMenu,
  Button,
  Skeleton,
} from "./ui";
import {
  Upload,
  FileText,
  Table,
  Plus,
  FolderOpen,
  Search,
  History,
  Mail,
  MessageCircle,
  Link2,
  Share2,
  Eye,
  Download,
  Edit2,
  Shield,
} from "lucide-react";

interface DocumentsListProps {
  searchQuery?: string;
  onOpenDocument?: (docId: string, docType?: string) => void;
}

type DocPageFilter = "TODOS" | "ACTIVOS" | "PENDIENTES" | "INACTIVOS";

const getFileTypeIcon = (type: string) => {
  switch (type) {
    case "DOCX":
      return { Icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" };
    case "PDF":
      return { Icon: FileText, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" };
    case "XLSX":
      return { Icon: Table, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" };
    default:
      return { Icon: FileText, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" };
  }
};

const filterToApiStatus = (f: DocPageFilter): FileStatus | undefined => {
  if (f === "ACTIVOS") return "ACTIVO";
  if (f === "PENDIENTES") return "PENDIENTE";
  if (f === "INACTIVOS") return "INACTIVO";
  return undefined;
};

const shareMethodIconMap: Record<ShareMethod, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  whatsapp: <MessageCircle className="w-3 h-3" />,
  link: <Link2 className="w-3 h-3" />,
  system: <Share2 className="w-3 h-3" />,
  other: <Share2 className="w-3 h-3" />,
};

const shareMethodColorMap: Record<ShareMethod, string> = {
  email: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  whatsapp: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  link: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  system: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  other: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const shareMethodLabelMap: Record<ShareMethod, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  link: "Enlace",
  system: "Compartido",
  other: "Compartido",
};

// Mapas para el badge de permisos del usuario
const permissionBadgeConfig: Record<DocumentPermissionLevel, { icon: React.ElementType; label: string; color: string }> = {
  none: { icon: Shield, label: "Sin acceso", color: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
  download: { icon: Download, label: "Descarga", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  read: { icon: Eye, label: "Lectura", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  write: { icon: Edit2, label: "Escritura", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  admin: { icon: Shield, label: "Admin", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
};

// Helper para verificar si el usuario tiene permiso de escritura
function hasWritePermission(permission: DocumentPermissionLevel | undefined): boolean {
  const level = permission ?? 'none';
  return level === 'write' || level === 'admin';
}

// Detecta si el contacto es genérico (no es un email/teléfono real)
function isGenericContact(contact: string): boolean {
  const genericPatterns = [
    "compartido via",
    "enlace copiado",
    "compartido",
    "via sistema",
    "system",
  ];
  const lower = contact.toLowerCase();
  return genericPatterns.some(p => lower.includes(p));
}

function truncateContact(contact: string, maxLen = 18): string {
  if (contact.length <= maxLen) return contact;
  // Si es email, truncar antes del @
  if (contact.includes("@")) {
    const [local, domain] = contact.split("@");
    if (local.length > 8) {
      return `${local.substring(0, 6)}...@${domain.substring(0, 8)}${domain.length > 8 ? "..." : ""}`;
    }
  }
  return contact.substring(0, maxLen - 3) + "...";
}

export const DocumentsList: React.FC<DocumentsListProps> = ({
  searchQuery: searchQueryProp = "",
  onOpenDocument,
}) => {
  const navigate = useNavigate();
  const layout = useOutletContext<AppLayoutOutletContext>();
  const searchQuery = searchQueryProp || layout?.searchQuery || "";
  const openUploadModal = layout?.openUploadModal ?? (() => {});
  const documentsInvalidateSeq = layout?.documentsInvalidateSeq ?? 0;

  const perPage = 10;
  const [filter, setFilter] = useState<DocPageFilter>("TODOS");
  const fileStatus = filterToApiStatus(filter);

  const {
    documents,
    loading,
    total,
    page,
    totalPages,
    setPage,
    refresh,
    deleteDocument,
    updateStatus,
  } = useDocuments({
    search: searchQuery,
    fileStatus,
    limit: perPage,
  });

  const [counts, setCounts] = useState({ todos: 0, activos: 0, pendientes: 0, inactivos: 0 });
  const [assignOpenCount, setAssignOpenCount] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [recentlyOpened, setRecentlyOpened] = useState<RecentlyOpenedItem[]>([]);
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);
  const [permissionsDocument, setPermissionsDocument] = useState<Document | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteSecondsLeft, setConfirmDeleteSecondsLeft] = useState(0);
  const deleteConfirmTimerRef = useRef<number | null>(null);
  const invalidateBootRef = useRef(true);

  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => openUploadModal(files),
  });

  const fetchCounts = useCallback(async () => {
    try {
      const [all, a, p, i, assignRes] = await Promise.all([
        documentsApi.list({ limit: 1, page: 1 }),
        documentsApi.list({ limit: 1, page: 1, fileStatus: "ACTIVO" }),
        documentsApi.list({ limit: 1, page: 1, fileStatus: "PENDIENTE" }),
        documentsApi.list({ limit: 1, page: 1, fileStatus: "INACTIVO" }),
        assignmentsApi.listReceived({ limit: 1, page: 1, pendingWork: true }),
      ]);
      setCounts({
        todos: all.pagination.total,
        activos: a.pagination.total,
        pendientes: p.pagination.total,
        inactivos: i.pagination.total,
      });
      setAssignOpenCount(assignRes.pagination.total);
    } catch (err) {
      console.error("Error cargando conteos:", err);
    }
  }, []);

  const refreshRecentlyOpened = useCallback(() => {
    recentlyOpenedApi
      .list(40)
      .then((res) => setRecentlyOpened(res.data ?? []))
      .catch(() => setRecentlyOpened([]));
  }, []);

  const refreshPendingAssignments = useCallback(() => {
    assignmentsApi
      .listReceived({ limit: 40, page: 1, pendingWork: true })
      .then((res) => setPendingAssignments(res.data ?? []))
      .catch(() => setPendingAssignments([]));
  }, []);

  useEffect(() => {
    void fetchCounts();
    refreshRecentlyOpened();
    refreshPendingAssignments();
  }, [fetchCounts, refreshRecentlyOpened, refreshPendingAssignments, documentsInvalidateSeq]);

  useEffect(() => {
    if (invalidateBootRef.current) {
      invalidateBootRef.current = false;
      return;
    }
    void refresh();
  }, [documentsInvalidateSeq, refresh]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, setPage]);

  useEffect(() => {
    return () => {
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
      }
    };
  }, []);

  const recentDocIds = new Set(
    recentlyOpened.filter((r) => r.entityType === "document").map((r) => r.id),
  );

  const pillPendientesTotal = counts.pendientes + assignOpenCount;

  const pendingAssignedDocuments: Document[] = pendingAssignments
    .map((assignment) => {
      const doc = assignment.document;
      if (!doc) return null;
      return {
        id: doc.id,
        name: doc.name,
        type: (doc.type || "docx").toUpperCase() as Document["type"],
        lastModified: new Date(assignment.createdAt).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        timeAgo: "Asignado",
        fileStatus: "PENDIENTE",
        lastEditor: assignment.assigner?.name ?? "Asignado",
        currentUserPermission: "write",
      } as Document;
    })
    .filter((doc): doc is Document => Boolean(doc));

  const documentsForList =
    filter === "PENDIENTES"
      ? [
          ...documents,
          ...pendingAssignedDocuments.filter(
            (assignedDoc) =>
              !documents.some((doc) => doc.id === assignedDoc.id) &&
              (!searchQuery.trim() || assignedDoc.name.toLowerCase().includes(searchQuery.toLowerCase())),
          ),
        ]
      : documents;

  const handleDocumentOpen = (doc: Document) => {
    if (onOpenDocument) onOpenDocument(doc.id, doc.type);
    else navigate(getDocumentRoute(doc.id, doc.type));
  };

  const handleSetFileStatus = async (doc: Document, status: FileStatus) => {
    if (doc.fileStatus === status) return;
    try {
      await updateStatus(doc.id, status);
      void fetchCounts();
    } catch (err) {
      console.error("Error cambiando estado:", err);
    }
  };

  const handleDelete = (doc: Document) => {
    if (confirmDeleteDocId === doc.id) {
      if (confirmDeleteSecondsLeft > 0) return;
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
        deleteConfirmTimerRef.current = null;
      }
      setConfirmDeleteDocId(null);
      setConfirmDeleteSecondsLeft(0);
      void (async () => {
        try {
          await deleteDocument(doc.id);
          await fetchCounts();
          refreshRecentlyOpened();
        } catch (e) {
          console.error(e);
        }
      })();
    } else {
      setConfirmDeleteDocId(doc.id);
      setConfirmDeleteSecondsLeft(3);
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
      }
      deleteConfirmTimerRef.current = window.setInterval(() => {
        setConfirmDeleteSecondsLeft((prev) => {
          if (prev <= 1) {
            if (deleteConfirmTimerRef.current) {
              window.clearInterval(deleteConfirmTimerRef.current);
              deleteConfirmTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleRowClick = (e: React.MouseEvent, doc: Document) => {
    if ((e.target as HTMLElement).closest("button")) return;
    handleDocumentOpen(doc);
  };

  const renderSyncCell = (doc: Document) => {
    const v = documentSyncVisual(doc);
    if (v === "completed") {
      return (
        <span className="material-symbols-outlined text-green-500 text-lg" title="Sincronizado con Drive">
          cloud_done
        </span>
      );
    }
    if (v === "syncing") {
      return (
        <span className="material-symbols-outlined text-amber-500 text-lg animate-pulse" title="Sincronizando…">
          cloud_sync
        </span>
      );
    }
    if (v === "failed") {
      return (
        <span className="material-symbols-outlined text-red-500 text-lg" title="Error de sincronización">
          cloud_off
        </span>
      );
    }
    return (
      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-lg" title="Sin sincronizar">
        cloud_upload
      </span>
    );
  };

  const statusButtons = (doc: Document) => {
    const canEdit = hasWritePermission(doc.currentUserPermission);
    
    return (
      <div
        className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {(["ACTIVO", "PENDIENTE", "INACTIVO"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => canEdit && void handleSetFileStatus(doc, status)}
            disabled={!canEdit}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-colors ${
              doc.fileStatus === status
                ? status === "ACTIVO"
                  ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700"
                  : status === "PENDIENTE"
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700"
                    : "bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500"
                : canEdit
                  ? "bg-transparent text-slate-500 border-transparent hover:bg-white dark:hover:bg-slate-700 dark:text-slate-400"
                  : "bg-transparent text-slate-400 border-transparent cursor-not-allowed dark:text-slate-500"
            }`}
            title={
              !canEdit
                ? "No tienes permiso para cambiar el estado"
                : status === "ACTIVO" ? "Marcar activo" : status === "PENDIENTE" ? "Marcar pendiente" : "Marcar inactivo"
            }
          >
            {status === "ACTIVO" ? "Activo" : status === "PENDIENTE" ? "Pend." : "Inact."}
          </button>
        ))}
      </div>
    );
  };

  const renderShareBadges = (doc: Document) => {
    const shares = doc.recentShares;
    if (!shares || shares.length === 0) return null;

    const maxVisible = 2;
    const visibleShares = shares.slice(0, maxVisible);
    const remainingCount = shares.length - maxVisible;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {visibleShares.map((share, idx) => {
          const isGeneric = isGenericContact(share.sharedWith);
          const displayText = isGeneric 
            ? shareMethodLabelMap[share.shareMethod]
            : truncateContact(share.sharedWith, 12);
          const tooltipText = isGeneric
            ? `Compartido via ${shareMethodLabelMap[share.shareMethod]}`
            : `Compartido con ${share.sharedWith}`;

          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${shareMethodColorMap[share.shareMethod]}`}
              title={tooltipText}
            >
              {shareMethodIconMap[share.shareMethod]}
              <span className="max-w-[80px] truncate">{displayText}</span>
            </span>
          );
        })}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            +{remainingCount} más
          </span>
        )}
      </div>
    );
  };

  const renderPermissionBadge = (doc: Document) => {
    const permission = doc.currentUserPermission ?? 'read';
    // No mostrar badge si es admin (usualmente el dueño)
    if (permission === 'admin') return null;
    
    const config = permissionBadgeConfig[permission];
    const IconComponent = config.icon;
    
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.color}`}
        title={`Tu permiso: ${config.label}`}
      >
        <IconComponent className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <>
      {isDraggingOver && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border-2 border-primary">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">Suelta el archivo aquí</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se abrirá el modal de subida para adjuntar tu documento
            </p>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <nav className="flex gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              <Link to="/" className="hover:text-primary">
                Inicio
              </Link>
              <span>/</span>
              <span className="text-slate-900 dark:text-white">Documentos</span>
            </nav>
            <h1 className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight">
              Gestión de Documentos
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              Administre y visualice los documentos del despacho con total claridad.
            </p>
          </div>
          <Button icon={Plus} onClick={() => openUploadModal()} className="shrink-0">
            Nuevo Documento
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {(
            [
              { key: "TODOS" as const, label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
              { key: "ACTIVOS" as const, label: "Activos", count: counts.activos, icon: "verified", color: "text-green-600" },
              { key: "PENDIENTES" as const, label: "Pendientes", count: pillPendientesTotal, icon: "pending", color: "text-orange-600" },
              { key: "INACTIVOS" as const, label: "Inactivos", count: counts.inactivos, icon: "error", color: "text-red-600" },
            ] as const
          ).map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilter(pill.key)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all shrink-0 ${
                filter === pill.key
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${filter === pill.key ? "" : pill.color}`}>
                {pill.icon}
              </span>
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm flex flex-col overflow-hidden">
          <div className="hidden md:block overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">
                    Nombre
                  </th>
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%]">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[20%]">
                    Última modificación
                  </th>
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[18%] text-center">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[8%] text-center">
                    Sync
                  </th>
                  <th className="px-6 py-4 text-slate-900 dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%] text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4">
                          <Skeleton className="h-5 w-3/4 rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <Skeleton className="h-5 w-12 rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <Skeleton className="h-5 w-24 rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <Skeleton className="h-8 w-28 mx-auto rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <Skeleton className="h-5 w-8 mx-auto rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <Skeleton className="h-8 w-10 ml-auto rounded" />
                        </td>
                      </tr>
                    ))
                : documentsForList.length === 0
                    ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                            {searchQuery.trim() ? (
                              <>
                                <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-slate-700 dark:text-slate-200">Sin resultados</p>
                                <p className="text-sm mt-1">No hay documentos para &quot;{searchQuery}&quot;</p>
                              </>
                            ) : (
                              <>
                                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="font-semibold text-slate-700 dark:text-slate-200">No hay documentos</p>
                                <p className="text-sm mt-1">Suba un documento para comenzar</p>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    : (
                        documentsForList.map((doc) => {
                          const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
                          const isRecent = recentDocIds.has(doc.id);
                          return (
                            <tr
                              key={doc.id}
                              onClick={(e) => handleRowClick(e, doc)}
                              className="transition-colors cursor-pointer relative hover:bg-slate-50 dark:hover:bg-slate-700/20"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeBg}`}
                                  >
                                    <TypeIcon className={`w-4 h-4 ${typeColor}`} />
                                  </div>
                                  <div className="min-w-0 flex flex-col">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-slate-900 dark:text-white font-bold text-sm truncate max-w-[200px] sm:max-w-[280px]">
                                        {doc.name}
                                      </span>
                                      {renderPermissionBadge(doc)}
                                      {isRecent && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 shrink-0">
                                          <History className="w-3 h-3" />
                                          Reciente
                                        </span>
                                      )}
                                    </div>
                                    {renderShareBadges(doc)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                {doc.type}
                              </td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
                                {doc.lastModified}
                              </td>
                              <td className="px-6 py-4 text-center">{statusButtons(doc)}</td>
                              <td className="px-6 py-4 text-center">{renderSyncCell(doc)}</td>
                              <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex justify-end">
                                  <ActionMenu
                                    items={buildDocumentActionMenuItems(doc, {
                                      onOpen: () => handleDocumentOpen(doc),
                                      onShare: () => setShareDocument(doc),
                                      onAssign: () => setAssignDocument(doc),
                                      onPermissions: () => setPermissionsDocument(doc),
                                      onDelete: () => handleDelete(doc),
                                      confirmDeleteDocId,
                                      confirmDeleteSecondsLeft,
                                    })}
                                    onClose={() => {
                                      if (confirmDeleteDocId === doc.id) {
                                        setConfirmDeleteDocId(null);
                                        setConfirmDeleteSecondsLeft(0);
                                        if (deleteConfirmTimerRef.current) {
                                          window.clearInterval(deleteConfirmTimerRef.current);
                                          deleteConfirmTimerRef.current = null;
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col divide-y divide-slate-200 dark:divide-slate-700/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse flex flex-col gap-3">
                    <Skeleton className="h-6 w-3/4 rounded" />
                    <Skeleton className="h-4 w-1/2 rounded" />
                    <Skeleton className="h-8 w-full mt-2 rounded" />
                  </div>
                ))
              : documentsForList.length === 0
                ? (
                    <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      {searchQuery.trim() ? (
                        <>
                          <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold">Sin resultados para &quot;{searchQuery}&quot;</p>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold">No hay documentos</p>
                        </>
                      )}
                    </div>
                  )
                : (
                    documentsForList.map((doc) => {
                      const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
                      const isRecent = recentDocIds.has(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={(e) => handleRowClick(e, doc)}
                          className="p-4 flex flex-col gap-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/20"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeBg}`}>
                              <TypeIcon className={`w-5 h-5 ${typeColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-slate-900 dark:text-white font-bold text-base leading-tight">
                                {doc.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {renderPermissionBadge(doc)}
                                {isRecent && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                    <History className="w-3 h-3" />
                                    Reciente
                                  </span>
                                )}
                              </div>
                              {renderShareBadges(doc)}
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{doc.lastModified}</p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Tipo</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{doc.type}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Sync</span>
                              {renderSyncCell(doc)}
                            </div>
                            <div className="flex justify-center pt-1">{statusButtons(doc)}</div>
                          </div>
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <ActionMenu
                              items={buildDocumentActionMenuItems(doc, {
                                onOpen: () => handleDocumentOpen(doc),
                                onShare: () => setShareDocument(doc),
                                onAssign: () => setAssignDocument(doc),
                                onPermissions: () => setPermissionsDocument(doc),
                                onDelete: () => handleDelete(doc),
                                confirmDeleteDocId,
                                confirmDeleteSecondsLeft,
                              })}
                              onClose={() => {
                                if (confirmDeleteDocId === doc.id) {
                                  setConfirmDeleteDocId(null);
                                  setConfirmDeleteSecondsLeft(0);
                                  if (deleteConfirmTimerRef.current) {
                                    window.clearInterval(deleteConfirmTimerRef.current);
                                    deleteConfirmTimerRef.current = null;
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
          </div>

          <div className="px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between border-t border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-primary disabled:opacity-50 transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              Página <span className="text-primary">{page}</span> de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-bold text-primary hover:border-primary disabled:opacity-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>

        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Mostrando {documentsForList.length} de {filter === "PENDIENTES" ? pillPendientesTotal : total} documentos
          {filter !== "TODOS" ? " (filtrado)" : ""}
          {searchQuery.trim() ? ` · búsqueda: "${searchQuery}"` : ""}.
        </p>
      </main>

      {shareDocument && (
        <ShareModal
          document={shareDocument}
          onClose={() => setShareDocument(null)}
          onShareLogged={() => void refresh()}
        />
      )}
      {assignDocument && (
        <AssignModal
          document={assignDocument}
          onClose={() => {
            setAssignDocument(null);
            void refresh();
            void fetchCounts();
          }}
        />
      )}
      {permissionsDocument && (
        <DocumentPermissionsModal
          document={permissionsDocument}
          onClose={() => setPermissionsDocument(null)}
          onSave={() => {
            setPermissionsDocument(null);
            void refresh();
          }}
        />
      )}
    </>
  );
};
