import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useDocumentPins } from "../lib/useDocumentPins";
import { startDocDrag, endDocDrag } from "../lib/docDrag";
import { getDocumentRoute } from "../lib/routes";
import { buildDocumentActionMenuItems } from "../lib/documentActionMenu";
import type { AppLayoutOutletContext } from "./AppLayout";
import { SaveStatusBadge } from "./SaveStatusBadge";
import { ShareModal } from "./ShareModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { AssignModal } from "./AssignModal";
import { CloudDocThumbnail } from "./CloudDocThumbnail";
import {
  ActionMenu,
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
  Pin,
} from "lucide-react";
import { DateRangeFilter } from "./DateRangeFilter";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import { DocumentTypeFilter, type DocumentTypeCounts, type DocumentTypeFilterValue } from "./DocumentTypeFilter";
import { documentsApi as _docApiForPreview, type ApiDocument } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { canChangeDocumentFileStatus } from "../lib/documentPermissions";
import { FileStatusIconToggle } from "./FileStatusIconToggle";

interface DocumentsListProps {
  searchQuery?: string;
  onOpenDocument?: (docId: string, docType?: string) => void;
}

type DocPageFilter = "TODOS" | "ACTIVOS" | "PENDIENTES" | "INACTIVOS";

const typeFilterToApiType = (type: DocumentTypeFilterValue) => {
  if (type === "TODOS") return undefined;
  return type.toLowerCase();
};

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
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilterValue>("TODOS");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const fileStatus = filterToApiStatus(filter);
  const documentType = typeFilterToApiType(typeFilter);

  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const { addToast } = useToast();
  const { user } = useAuth();
  const { pinnedIds, toggle: togglePin } = useDocumentPins();

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
    type: documentType,
    fileStatus,
    limit: perPage,
    from: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
    to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    onDeleted: useCallback((id: string, docName: string) => {
      const name = docName || "El documento";
      addToast({
        message: `"${name}" se movió a la papelera`,
        type: "success",
        actionLabel: "Deshacer",
        duration: 5000,
        action: async () => {
          try {
            await documentsApi.restore(id);
            await refreshRef.current?.();
            addToast({ message: `"${name}" restaurado`, type: "success" });
          } catch {
            addToast({ message: `Error al restaurar "${name}"`, type: "error" });
          }
        },
      });
    }, [addToast]),
  });

  const [counts, setCounts] = useState({ todos: 0, activos: 0, pendientes: 0, inactivos: 0 });
  const [typeCounts, setTypeCounts] = useState<DocumentTypeCounts>({ TODOS: 0, DOCX: 0, XLSX: 0, PDF: 0 });
  const [assignOpenCount, setAssignOpenCount] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [recentlyOpened, setRecentlyOpened] = useState<RecentlyOpenedItem[]>([]);
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);
  const [permissionsDocument, setPermissionsDocument] = useState<Document | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ApiDocument | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteSecondsLeft, setConfirmDeleteSecondsLeft] = useState(0);
  const deleteConfirmTimerRef = useRef<number | null>(null);
  const invalidateBootRef = useRef(true);

  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => openUploadModal(files),
  });

  // Keep refreshRef current for undo toast callback
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const fetchCounts = useCallback(async () => {
    try {
      const selectedType = typeFilterToApiType(typeFilter);
      const [all, a, p, i, assignRes] = await Promise.all([
        documentsApi.list({ limit: 1, page: 1, type: selectedType }),
        documentsApi.list({ limit: 1, page: 1, type: selectedType, fileStatus: "ACTIVO" }),
        documentsApi.list({ limit: 1, page: 1, type: selectedType, fileStatus: "PENDIENTE" }),
        documentsApi.list({ limit: 1, page: 1, type: selectedType, fileStatus: "INACTIVO" }),
        assignmentsApi.listReceived({ limit: selectedType ? 100 : 1, page: 1, pendingWork: true }),
      ]);
      const selectedAssignOpenCount = selectedType
        ? assignRes.data.filter((assignment) => assignment.document?.type?.toLowerCase() === selectedType).length
        : assignRes.pagination.total;
      setCounts({
        todos: all.pagination.total,
        activos: a.pagination.total,
        pendientes: p.pagination.total,
        inactivos: i.pagination.total,
      });
      setAssignOpenCount(selectedAssignOpenCount);
      const [docx, xlsx, pdf] = await Promise.all([
        documentsApi.list({ limit: 1, page: 1, type: "docx" }),
        documentsApi.list({ limit: 1, page: 1, type: "xlsx" }),
        documentsApi.list({ limit: 1, page: 1, type: "pdf" }),
      ]);
      setTypeCounts({
        TODOS: all.pagination.total,
        DOCX: docx.pagination.total,
        XLSX: xlsx.pagination.total,
        PDF: pdf.pagination.total,
      });
    } catch (err) {
      console.error("Error cargando conteos:", err);
    }
  }, [typeFilter]);

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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
      void fetchCounts();
      refreshRecentlyOpened();
      refreshPendingAssignments();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh, fetchCounts, refreshRecentlyOpened, refreshPendingAssignments]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, typeFilter, setPage]);

  useEffect(() => {
    return () => {
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  // Fetch full ApiDocument for preview (with localPath/mimeType needed)
  const handlePreview = useCallback(async (doc: Document) => {
    try {
      const full = await _docApiForPreview.get(doc.id);
      setPreviewDoc(full);
    } catch { /* ignore */ }
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
              (typeFilter === "TODOS" || assignedDoc.type === typeFilter) &&
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
          await deleteDocument(doc.id, doc.name);
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

  const sortedDocuments = useMemo(
    () =>
      [...documentsForList].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 1 : 0;
        const bp = pinnedIds.has(b.id) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }),
    [documentsForList, pinnedIds],
  );

  const tabConfig: Record<string, { label: string; cls: string }> = {
    ACTIVO:   { label: "Activo",   cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300" },
    PENDIENTE:{ label: "Pendiente",cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    INACTIVO: { label: "Inactivo", cls: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" },
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

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <nav className="flex gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Link to="/" className="hover:text-primary transition-colors">Inicio</Link>
              <span>/</span>
              <span className="text-slate-900 dark:text-white">Documentos</span>
            </nav>
            <h1 className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight">
              Todos los documentos
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Administra y visualiza todos los documentos del despacho.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          <DocumentTypeFilter
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
            counts={typeCounts}
          />
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar flex-1 min-w-0">
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
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold shadow-sm transition-all shrink-0 ${
                  filter === pill.key
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] leading-none ${filter === pill.key ? "" : pill.color}`}>
                  {pill.icon}
                </span>
                {pill.label} ({pill.count})
              </button>
            ))}
          </div>
          <div className="shrink-0">
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }}
            />
          </div>
        </div>

        {/* Grid de miniaturas */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 overflow-hidden">
                <Skeleton className="aspect-[3/4] w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                  <Skeleton className="h-7 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedDocuments.length === 0 ? (
          <div className="py-16 text-center">
            {searchQuery.trim() ? (
              <>
                <Search className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">Sin resultados</p>
                <p className="text-sm text-slate-500 mt-1">No hay documentos para &quot;{searchQuery}&quot;</p>
              </>
            ) : (
              <>
                <FolderOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">No hay documentos</p>
                <p className="text-sm text-slate-500 mt-1">Sube un documento para comenzar</p>
                <button
                  type="button"
                  onClick={() => openUploadModal()}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Documento
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedDocuments.map((doc) => {
              const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
              const tab = tabConfig[doc.fileStatus ?? "ACTIVO"] ?? tabConfig.ACTIVO;
              const canEdit = canChangeDocumentFileStatus(doc, user?.id);
              const pinned = pinnedIds.has(doc.id);

              return (
                <article
                  key={doc.id}
                  className="group relative mt-3 cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-primary/40 hover:bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 flex flex-col"
                  onClick={() => handleDocumentOpen(doc)}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => startDocDrag(e, { id: doc.id, name: doc.name, type: doc.type })}
                  onDragEnd={() => endDocDrag()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDocumentOpen(doc); }
                  }}
                >
                  {/* Pestaña estado */}
                  <div className={`absolute left-4 top-0 z-10 -translate-y-full rounded-t-lg border border-b-0 px-2.5 py-0.5 text-[11px] font-semibold ${tab.cls}`}>
                    {tab.label}
                  </div>

                  {/* Miniatura real del documento */}
                  <div className="relative">
                    <CloudDocThumbnail doc={doc} />
                    <button
                      type="button"
                      aria-pressed={pinned}
                      title={pinned ? "Quitar fijación" : "Fijar"}
                      className={`absolute left-2 top-2 z-20 rounded-md border p-1.5 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        pinned
                          ? "opacity-100 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                          : "opacity-0 group-hover:opacity-100 border-slate-200 bg-white/95 text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        void (async () => {
                          const ok = await togglePin(doc.id);
                          if (!ok) {
                            addToast({ message: "No se pudo actualizar la fijación", type: "error" });
                          }
                        })();
                      }}
                    >
                      <Pin
                        className={`w-3.5 h-3.5 ${pinned ? "fill-current" : ""}`}
                        strokeWidth={pinned ? 2.5 : 2}
                      />
                    </button>
                    <div className="absolute right-2 top-2 z-10 rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-2 p-3 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2">
                      {doc.name}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{doc.lastModified}</p>

                    {renderShareBadges(doc)}

                    <div className="mt-auto">
                      <FileStatusIconToggle
                        value={doc.fileStatus ?? "ACTIVO"}
                        disabled={!canEdit}
                        onChange={(status) => void handleSetFileStatus(doc, status)}
                      />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div
                    className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                </article>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-primary disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
              Página <span className="text-primary">{page}</span> de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-primary hover:border-primary disabled:opacity-40 transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}

        <p className="text-slate-400 dark:text-slate-500 text-xs">
          {sortedDocuments.length} de {filter === "PENDIENTES" ? pillPendientesTotal : total} documentos
          {filter !== "TODOS" ? " (filtrado)" : ""}
          {searchQuery.trim() ? ` · búsqueda: "${searchQuery}"` : ""}
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

      {/* Document Preview Panel */}
      <DocumentPreviewPanel
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onShare={previewDoc ? () => {
          const frontendDoc = documentsForList.find(d => d.id === previewDoc.id);
          if (frontendDoc) setShareDocument(frontendDoc);
          setPreviewDoc(null);
        } : undefined}
      />
    </>
  );
};
