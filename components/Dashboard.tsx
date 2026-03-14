import React, { useState, useRef, useEffect, useCallback } from "react";
import { Document, FileStatus } from "../types";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { useDocuments } from "../lib/useDocuments";
import { useFileDragDrop } from "../lib/useFileDragDrop";
import { assignmentsApi, type ApiDocumentAssignment } from "../lib/api";
import { ShareModal } from "./ShareModal";
import { AdminAccessModal } from "./AdminAccessModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { AssignModal } from "./AssignModal";
import { useAuth } from "../contexts/AuthContext";
import { UserAvatar } from "./UserAvatar";
import {
  PageHeader,
  StatCard,
  FilterBar,
  StatusBadge,
  SectionCard,
  ActionMenu,
  EmptyState,
  Skeleton,
  Button,
} from "./ui";
import type { FilterPill, ActionMenuItem, StatusTone } from "./ui";
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  FileUp,
  Users,
  ArrowRight,
  MoreVertical,
  Calendar,
  Edit3,
  Archive,
  Share2,
  UserPlus,
  Shield,
  Trash2,
  Eye,
  Plus,
  Table,
  FolderOpen,
  Upload,
  ArchiveRestore,
  Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

interface LayoutContext {
  searchQuery: string;
  openUploadModal: (files?: File[]) => void;
  refreshDocuments: () => Promise<void>;
}

interface DashboardProps {
  onOpenUploadModal?: (files?: File[]) => void;
  isUploadModalOpen?: boolean;
  searchQuery?: string;
  onOpenDocument?: (docId: string, docType?: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const FILE_STATUS_TONE: Record<FileStatus, StatusTone> = {
  ACTIVO: "success",
  PENDIENTE: "warning",
  INACTIVO: "neutral",
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

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  visto: "Visto",
  editado: "Editado",
  revisado: "Revisado",
  completado: "Completado",
  rechazado: "Rechazado",
};

const matchesSearch = (doc: Document, q: string): boolean => {
  if (!q.trim()) return true;
  const term = q.trim().toLowerCase();
  return (
    doc.name.toLowerCase().includes(term) ||
    (doc.type && doc.type.toLowerCase().includes(term))
  );
};

// ─── Component ────────────────────────────────────────────────────────────

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenUploadModal: onOpenUploadModalProp,
  isUploadModalOpen = false,
  searchQuery: searchQueryProp = "",
  onOpenDocument,
}) => {
  // Context from AppLayout
  const layoutContext = useOutletContext<LayoutContext | undefined>();
  const onOpenUploadModal = onOpenUploadModalProp ?? layoutContext?.openUploadModal;
  const searchQuery = searchQueryProp || layoutContext?.searchQuery || "";

  const navigate = useNavigate();
  const {
    documents,
    loading,
    refresh: onRefresh,
    deleteDocument: handleDeleteDoc,
    updateStatus: onStatusChange,
  } = useDocuments();
  const { user } = useAuth();
  const currentUserRole = user?.role ?? "asistente";

  // ─── Local state ──────────────────────────────────────────────────────

  const [filter, setFilter] = useState("TODOS");
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);
  const [permissionsDocument, setPermissionsDocument] = useState<Document | null>(null);
  const [adminAccessDocument, setAdminAccessDocument] = useState<Document | null>(null);
  const [adminUnlockedForSession, setAdminUnlockedForSession] = useState(false);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteSecondsLeft, setConfirmDeleteSecondsLeft] = useState(0);
  const [assignmentsReceived, setAssignmentsReceived] = useState<ApiDocumentAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const deleteConfirmTimerRef = useRef<number | null>(null);

  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => onOpenUploadModal?.(files),
    disabled: isUploadModalOpen,
  });

  const refreshAssignments = useCallback(() => {
    setAssignmentsLoading(true);
    assignmentsApi
      .listReceived({ limit: 30, status: "pendiente" })
      .then((res) => setAssignmentsReceived(res.data ?? []))
      .catch(() => setAssignmentsReceived([]))
      .finally(() => setAssignmentsLoading(false));
  }, []);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments, documents.length]);

  // ─── Document action handlers ─────────────────────────────────────────

  const handleDocumentClick = (doc: Document) => {
    if (onOpenDocument) {
      onOpenDocument(doc.id, doc.type);
    } else {
      navigate(`/documento/${doc.id}`);
    }
  };

  const handleArchive = async (doc: Document) => {
    const nextStatus: FileStatus = doc.fileStatus === "INACTIVO" ? "ACTIVO" : "INACTIVO";
    try {
      await onStatusChange(doc.id, nextStatus);
    } catch (err) {
      console.error("Error archivando:", err);
    }
  };

  const handleSetFileStatus = async (doc: Document, status: FileStatus) => {
    if (doc.fileStatus === status) return;
    try {
      await onStatusChange(doc.id, status);
    } catch (err) {
      console.error("Error cambiando estado:", err);
    }
  };

  const handleDelete = (doc: Document) => {
    if (confirmDeleteDocId === doc.id) {
      if (confirmDeleteSecondsLeft > 0) {
        return;
      }
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
        deleteConfirmTimerRef.current = null;
      }
      setConfirmDeleteDocId(null);
      setConfirmDeleteSecondsLeft(0);
      handleDeleteDoc(doc.id);
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

  useEffect(() => {
    return () => {
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
      }
    };
  }, []);

  const handleAdminAccessSuccess = () => {
    setAdminUnlockedForSession(true);
    setAdminAccessDocument(null);
    onRefresh();
  };

  // ─── Build action menu items for a document ───────────────────────────

  const buildMenuItems = (doc: Document): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        label: "Abrir",
        icon: Eye,
        onClick: () => handleDocumentClick(doc),
      },
      {
        label: "Compartir",
        icon: Share2,
        onClick: () => setShareDocument(doc),
      },
      {
        label: "Asignar",
        icon: UserPlus,
        onClick: () => setAssignDocument(doc),
      },
      {
        label: "Permisos",
        icon: Shield,
        onClick: () => setPermissionsDocument(doc),
      },
      {
        label: doc.fileStatus === "INACTIVO" ? "Desarchivar" : "Archivar",
        icon: doc.fileStatus === "INACTIVO" ? ArchiveRestore : Archive,
        onClick: () => handleArchive(doc),
      },
      {
        label:
          confirmDeleteDocId === doc.id
            ? confirmDeleteSecondsLeft > 0
              ? `Habilitar confirmar (${confirmDeleteSecondsLeft}s)`
              : "Click para confirmar"
            : "Eliminar",
        icon: Trash2,
        onClick: () => handleDelete(doc),
        danger: true,
        separator: true,
        closeOnClick: confirmDeleteDocId === doc.id && confirmDeleteSecondsLeft === 0,
      },
    ];
    return items;
  };

  // ─── Computed data ────────────────────────────────────────────────────

  const pendingAssignments = assignmentsReceived.filter(
    (assignment) => assignment.status === "pendiente" && Boolean(assignment.document)
  );

  const counts = {
    activos: documents.filter((d) => d.fileStatus === "ACTIVO").length,
    pendientes:
      documents.filter((d) => d.fileStatus === "PENDIENTE").length +
      pendingAssignments.length,
    inactivos: documents.filter((d) => d.fileStatus === "INACTIVO").length,
    total: documents.length,
  };

  const filteredDocuments = documents.filter((doc) => {
    if (!matchesSearch(doc, searchQuery)) return false;
    switch (filter) {
      case "ACTIVOS":
        return doc.fileStatus === "ACTIVO";
      case "PENDIENTES":
        return doc.fileStatus === "PENDIENTE";
      case "INACTIVOS":
        return doc.fileStatus === "INACTIVO";
      default:
        return true;
    }
  });

  const pendingDocuments = documents
    .filter((d) => d.fileStatus === "PENDIENTE")
    .sort((a, b) => {
      // Expiring ones first
      if (a.expirationDate && !b.expirationDate) return -1;
      if (!a.expirationDate && b.expirationDate) return 1;
      if (a.expirationDate && b.expirationDate) {
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      }
      return 0;
    })
    .slice(0, 5);

  const filterPills: FilterPill[] = [
    { key: "TODOS", label: "Todos", count: counts.total },
    { key: "ACTIVOS", label: "Activos", icon: CheckCircle, count: counts.activos },
    { key: "PENDIENTES", label: "Pendientes", icon: Clock, count: counts.pendientes },
    { key: "INACTIVOS", label: "Inactivos", icon: AlertCircle, count: counts.inactivos },
  ];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Drag-and-drop overlay ──────────────────────────────────────── */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border-2 border-primary">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              Suelta el archivo aquí
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se abrirá el modal de subida para adjuntar tu documento
            </p>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <PageHeader
          title={`Bienvenido, ${user?.name ?? "Usuario"}`}
          description="Resumen de su despacho al día de hoy"
          action={
            user?.groupMemberships && user.groupMemberships.length > 0 ? (
              <Link
                to="/equipo"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                {user.groupMemberships[0].group.name}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : undefined
          }
        />

        {/* ── Stats Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Activos"
            value={counts.activos}
            icon={CheckCircle}
            variant="success"
            total={counts.total}
            onClick={() => setFilter("ACTIVOS")}
          />
          <StatCard
            label="Pendientes"
            value={counts.pendientes}
            icon={Clock}
            variant="warning"
            total={counts.total}
            onClick={() => setFilter("PENDIENTES")}
          />
          <StatCard
            label="Inactivos"
            value={counts.inactivos}
            icon={AlertCircle}
            variant="error"
            total={counts.total}
            onClick={() => setFilter("INACTIVOS")}
          />
          <StatCard
            label="Total"
            value={counts.total}
            icon={FileText}
            variant="primary"
            onClick={() => setFilter("TODOS")}
          />
        </div>

        {/* ── Main 2-Column Layout ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left Column: Document List (~60%) ──────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <SectionCard title="Documentos Recientes" noPadding>
              {/* Filter pills */}
              <div className="px-5 pt-4 pb-3">
                <FilterBar pills={filterPills} active={filter} onChange={setFilter} />
              </div>

              {/* Document list */}
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  /* Skeleton rows */
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/3 rounded" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded" />
                    </div>
                  ))
                ) : filteredDocuments.length === 0 ? (
                  <EmptyState
                    icon={searchQuery.trim() ? Search : FolderOpen}
                    title={
                      searchQuery.trim()
                        ? "Sin resultados de búsqueda"
                        : "No hay documentos"
                    }
                    description={
                      searchQuery.trim()
                        ? `No se encontraron documentos para "${searchQuery}"`
                        : "Suba un documento para comenzar"
                    }
                    variant={searchQuery.trim() ? "search" : "empty"}
                    action={
                      !searchQuery.trim() ? (
                        <Button
                          icon={Plus}
                          onClick={() => onOpenUploadModal?.()}
                        >
                          Nuevo Documento
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    {filteredDocuments.map((doc) => {
                      const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
                      const isExpiring = doc.fileStatus === "PENDIENTE" && doc.expirationDate;

                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleDocumentClick(doc)}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleDocumentClick(doc);
                            }
                          }}
                        >
                          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                            {/* File type icon */}
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${typeBg}`}
                            >
                              <TypeIcon className={`w-4.5 h-4.5 ${typeColor}`} />
                            </div>

                            {/* Name + meta */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {doc.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                                  <Calendar className="w-3 h-3" />
                                  {doc.lastModified}
                                </span>
                                {doc.lastEditor && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 min-w-0">
                                    <Edit3 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{doc.lastEditor}</span>
                                  </span>
                                )}
                                {isExpiring && (
                                  <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium shrink-0">
                                    <AlertCircle className="w-3 h-3" />
                                    Vence {doc.expirationDate}
                                  </span>
                                )}
                              </div>
                              {doc.assignments && doc.assignments.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {doc.assignments.map((a) => (
                                    <span
                                      key={a.id}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 max-w-full"
                                      title={`${a.assignee.name} · ${ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}`}
                                    >
                                      <UserAvatar
                                        name={a.assignee.name}
                                        avatarUrl={a.assignee.avatarUrl}
                                        className="w-4 h-4 rounded-full object-cover shrink-0"
                                      />
                                      <span className="font-medium truncate">{a.assignee.name}</span>
                                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                        {ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 pl-12 sm:pl-0 mt-2 sm:mt-0 shrink-0">
                            {/* Estado (permiso): Activo / Pendiente / Inactivo */}
                            <div
                              className="flex items-center gap-1 sm:gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(["ACTIVO", "PENDIENTE", "INACTIVO"] as const).map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => handleSetFileStatus(doc, status)}
                                  className={`px-2 py-1 sm:px-2 sm:py-1 rounded text-[10px] font-bold uppercase border transition-colors ${
                                    doc.fileStatus === status
                                      ? status === "ACTIVO"
                                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700"
                                        : status === "PENDIENTE"
                                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700"
                                          : "bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500"
                                      : "bg-transparent text-slate-500 border-transparent hover:bg-white dark:hover:bg-slate-700 dark:text-slate-400"
                                  }`}
                                  title={status === "ACTIVO" ? "Marcar activo" : status === "PENDIENTE" ? "Marcar pendiente" : "Marcar inactivo"}
                                >
                                  {status === "ACTIVO" ? "Activo" : status === "PENDIENTE" ? "Pend." : "Inact."}
                                </button>
                              ))}
                            </div>

                            {/* Action menu */}
                            <div
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ActionMenu
                                items={buildMenuItems(doc)}
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
                        </div>
                      );
                    })}

                    {/* "Nuevo Documento" add row */}
                    <div
                      onClick={() => onOpenUploadModal?.()}
                      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-t-2 border-dashed border-slate-200 dark:border-slate-700/60"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenUploadModal?.();
                        }
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          Nuevo Documento
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Subir archivo o crear nuevo
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </SectionCard>
          </div>

          {/* ── Right Column (~40%) ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pendientes: estado pendiente + asignados al usuario */}
            <SectionCard title="Pendientes" noPadding>
              {loading || assignmentsLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-2/3 rounded" />
                        <Skeleton className="h-3 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingDocuments.length === 0 && pendingAssignments.length === 0 ? (
                <div className="py-10 px-6 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Sin pendientes
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Todos los documentos están al día
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {pendingDocuments.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Estado pendiente
                        </p>
                      </div>
                      {pendingDocuments.map((doc) => {
                        const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
                        return (
                          <div
                            key={`pending-${doc.id}`}
                            onClick={() => handleDocumentClick(doc)}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleDocumentClick(doc);
                              }
                            }}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeBg}`}>
                              <TypeIcon className={`w-4 h-4 ${typeColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {doc.name}
                              </p>
                              {doc.expirationDate ? (
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5 font-medium">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  Vence {doc.expirationDate}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                  {doc.timeAgo}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          </div>
                        );
                      })}
                    </>
                  )}
                  {pendingAssignments.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Asignados a ti
                        </p>
                      </div>
                      {pendingAssignments.map((a) => {
                        const doc = a.document;
                        if (!doc) return null;
                        const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type ?? "DOCX");
                        const statusLabel = a.status === "pendiente" ? "Pendiente" : a.status === "visto" ? "Visto" : a.status === "editado" ? "Editado" : a.status;
                        return (
                          <div
                            key={`assign-${a.id}`}
                            onClick={() => navigate(`/documento/${doc.id}`)}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/documento/${doc.id}`);
                              }
                            }}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeBg}`}>
                              <TypeIcon className={`w-4 h-4 ${typeColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {doc.name}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {a.assigner?.name ?? "Asignado"} · {statusLabel}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Acciones Rápidas section */}
            <SectionCard title="Acciones Rápidas">
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  icon={FileUp}
                  onClick={() => onOpenUploadModal?.()}
                  className="w-full justify-start"
                >
                  Nuevo Documento
                </Button>
                <Button
                  variant="secondary"
                  icon={Users}
                  onClick={() => navigate("/equipo")}
                  className="w-full justify-start"
                >
                  Ver Equipo
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {shareDocument && (
        <ShareModal
          document={shareDocument}
          onClose={() => setShareDocument(null)}
        />
      )}

      {assignDocument && (
        <AssignModal
          document={assignDocument}
          onClose={() => {
            setAssignDocument(null);
            onRefresh();
            refreshAssignments();
          }}
        />
      )}

      {adminAccessDocument && (
        <AdminAccessModal
          documentId={adminAccessDocument.id}
          documentName={adminAccessDocument.name}
          onClose={() => setAdminAccessDocument(null)}
          onSuccess={handleAdminAccessSuccess}
        />
      )}

      {permissionsDocument && (
        <DocumentPermissionsModal
          document={permissionsDocument}
          onClose={() => setPermissionsDocument(null)}
          onSave={() => {
            setPermissionsDocument(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
};
