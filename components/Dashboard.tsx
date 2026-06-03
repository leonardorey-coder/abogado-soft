import React, { useState, useRef, useEffect, useCallback } from "react";
import { Document, FileStatus, ShareMethod } from "../types";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { useDocuments } from "../lib/useDocuments";
import { useFileDragDrop } from "../lib/useFileDragDrop";
import { assignmentsApi, documentsApi, activityApi, sharesApi, type ApiDocumentAssignment, type ApiActivityLog, type RecentlySharedItem } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";
import { matchesSearch } from "../lib/documentSearch";
import { buildDocumentActionMenuItems } from "../lib/documentActionMenu";
import { BitacoraEntryItem } from "./BitacoraEntryItem";
import { ShareModal } from "./ShareModal";
import { AdminAccessModal } from "./AdminAccessModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { AssignModal } from "./AssignModal";
import { OnboardingWizard, isOnboardingDone } from "./OnboardingWizard";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { canChangeDocumentFileStatus } from "../lib/documentPermissions";
import { FileStatusIconToggle } from "./FileStatusIconToggle";
import { UserAvatar } from "./UserAvatar";
import { DashboardCalendar } from "./DashboardCalendar";
import { startDocDrag, endDocDrag } from "../lib/docDrag";
import { getViewerLabel } from "../lib/viewerIdentity";
import {
  PageHeader,
  FilterBar,
  StatusBadge,
  SectionCard,
  ActionMenu,
  EmptyState,
  Skeleton,
  Button,
} from "./ui";
import type { FilterPill, StatusTone } from "./ui";
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  ArrowRight,
  Calendar,
  Edit3,
  Plus,
  Table,
  FolderOpen,
  Upload,
  Search,
  History,
  ScrollText,
  Mail,
  MessageCircle,
  Link2,
  Share2,
  UserCheck,
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

const NEW_DOC_FROM_QUICK_DEFAULT_NAME = "Documento sin título.docx";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const HOME_RECENT_LIST_LIMIT = 6;

// ─── Share badges helpers ──────────────────────────────────────────────────

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
  if (contact.includes("@")) {
    const [local, domain] = contact.split("@");
    if (local.length > 8) {
      return `${local.substring(0, 6)}...@${domain.substring(0, 8)}${domain.length > 8 ? "..." : ""}`;
    }
  }
  return contact.substring(0, maxLen - 3) + "...";
}

function renderShareBadges(doc: Document) {
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
}

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
  const { addToast } = useToast();
  const refreshRef = React.useRef<(() => Promise<void>) | null>(null);
  const {
    documents,
    loading,
    refresh: onRefresh,
    deleteDocument: handleDeleteDoc,
    updateStatus: onStatusChange,
  } = useDocuments({
    onDeleted: useCallback((id: string, docName: string) => {
      const nameToDisplay = docName || "El documento";
      addToast({
        message: `"${nameToDisplay}" se movió a la papelera`,
        type: "success",
        actionLabel: "Deshacer",
        duration: 5000,
        action: async () => {
          try {
            await documentsApi.restore(id);
            await refreshRef.current?.();
            addToast({ message: `"${nameToDisplay}" restaurado`, type: "success" });
          } catch {
            addToast({ message: `Error al restaurar "${nameToDisplay}"`, type: "error" });
          }
        },
      });
    }, [addToast]),
  });
  const { user } = useAuth();

  // Keep refreshRef current so the undo toast callback can call it without stale closure
  React.useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

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
  const [quickNewDocLoading, setQuickNewDocLoading] = useState(false);
  const [quickNewDocError, setQuickNewDocError] = useState<string | null>(null);
  const [recentlyShared, setRecentlyShared] = useState<RecentlySharedItem[]>([]);
  const [recentlySharedLoading, setRecentlySharedLoading] = useState(false);
  const deleteConfirmTimerRef = useRef<number | null>(null);

  // Onboarding: show wizard to new users
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!isOnboardingDone()) {
      // Small delay so the dashboard loads first
      const t = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => onOpenUploadModal?.(files),
    disabled: isUploadModalOpen,
  });

  const refreshAssignments = useCallback(() => {
    setAssignmentsLoading(true);
    Promise.all([
      assignmentsApi.listReceived({ limit: 40, pendingWork: true }),
      assignmentsApi.listSent({ limit: 40, pendingWork: true }),
    ])
      .then(([receivedRes, sentRes]) => {
        const all = [...(receivedRes.data ?? []), ...(sentRes.data ?? [])];
        const seen = new Set<string>();
        const unique = all.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        setAssignmentsReceived(unique);
      })
      .catch(() => setAssignmentsReceived([]))
      .finally(() => setAssignmentsLoading(false));
  }, []);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments, documents.length]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void onRefresh();
      refreshAssignments();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [onRefresh, refreshAssignments]);

  // ── Compartidos recientemente ────────────────────────────────────────────
  const refreshRecentlyShared = useCallback(() => {
    setRecentlySharedLoading(true);
    sharesApi
      .listRecent(10)
      .then((res) => setRecentlyShared(res.data ?? []))
      .catch(() => setRecentlyShared([]))
      .finally(() => setRecentlySharedLoading(false));
  }, []);

  useEffect(() => {
    refreshRecentlyShared();
    // Polling cada 90s para actualizar shares del equipo
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') refreshRecentlyShared();
    }, 90_000);
    return () => clearInterval(interval);
  }, [refreshRecentlyShared]);

  // ── Actividad reciente de documentos (polling 60s) ─────────────────────
  const [recentActivity, setRecentActivity] = useState<ApiActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const lastActivityFetchRef = useRef<Date | null>(null);

  const fetchRecentActivity = useCallback(async (isIncremental = false) => {
    try {
      if (!isIncremental) setActivityLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = isIncremental && lastActivityFetchRef.current
        ? lastActivityFetchRef.current.toISOString()
        : sevenDaysAgo.toISOString();
      const res = await activityApi.list({
        page: 1,
        limit: HOME_RECENT_LIST_LIMIT,
        category: 'documents',
        from,
      });
      const data: ApiActivityLog[] = res.data ?? [];
      lastActivityFetchRef.current = new Date();
      if (isIncremental && data.length > 0) {
        // Prepend new entries silently (small widget — no need for a banner)
        setRecentActivity(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const fresh = data.filter(e => !existingIds.has(e.id));
          return [...fresh, ...prev].slice(0, HOME_RECENT_LIST_LIMIT);
        });
      } else if (!isIncremental) {
        setRecentActivity(data.slice(0, HOME_RECENT_LIST_LIMIT));
      }
    } catch {
      // silently ignore
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Initial fetch + polling every 60s
  useEffect(() => {
    fetchRecentActivity(false);
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        fetchRecentActivity(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchRecentActivity]);

  // ─── Document action handlers ─────────────────────────────────────────

  const handleDocumentClick = (doc: Document) => {
    if (onOpenDocument) {
      onOpenDocument(doc.id, doc.type);
    } else {
      navigate(getDocumentRoute(doc.id, doc.type));
    }
  };

  const handleNewDocumentFromQuickActions = useCallback(async () => {
    setQuickNewDocError(null);
    setQuickNewDocLoading(true);
    try {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(new URL("blank.docx", window.location.origin + base).href);
      if (!res.ok) throw new Error("No se pudo cargar la plantilla del documento");
      const blob = await res.blob();
      const file = new File([blob], NEW_DOC_FROM_QUICK_DEFAULT_NAME, { type: DOCX_MIME });
      const created = await documentsApi.upload(file, { name: NEW_DOC_FROM_QUICK_DEFAULT_NAME });
      await onRefresh();
      if (onOpenDocument) onOpenDocument(created.id, created.type);
      else
        navigate(getDocumentRoute(created.id, created.type), {
          state: { seededDocument: created },
        });
    } catch (e) {
      console.error(e);
      setQuickNewDocError(e instanceof Error ? e.message : "Error al crear el documento");
    } finally {
      setQuickNewDocLoading(false);
    }
  }, [onRefresh, navigate, onOpenDocument]);

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
      handleDeleteDoc(doc.id, doc.name);
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

  // ─── Computed data ────────────────────────────────────────────────────

  const isAssignmentOpen = (s: string) =>
    s !== "completado" && s !== "activo" && s !== "revocado";
  const assignmentPendingSortOrder: Record<string, number> = {
    pendiente: 0,
    visto: 1,
    editado: 2,
    revisado: 3,
    rechazado: 4,
  };

  const pendingAssignments = assignmentsReceived
    .filter((a) => isAssignmentOpen(a.status) && Boolean(a.document))
    .sort(
      (a, b) =>
        (assignmentPendingSortOrder[a.status] ?? 99) - (assignmentPendingSortOrder[b.status] ?? 99),
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
      } as Document;
    })
    .filter((doc): doc is Document => Boolean(doc));

  const filteredDocumentsForList =
    filter === "PENDIENTES"
      ? [
          ...filteredDocuments,
          ...pendingAssignedDocuments.filter(
            (assignedDoc) =>
              !filteredDocuments.some((doc) => doc.id === assignedDoc.id) &&
              matchesSearch(assignedDoc, searchQuery),
          ),
        ]
      : filteredDocuments;

  const latestActivityByDocument = recentActivity.reduce<Record<string, number>>((acc, entry) => {
    const entityType = (entry.entityType ?? "").toLowerCase();
    if (entityType !== "document" || !entry.entityId) return acc;
    const ts = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(ts)) return acc;
    const prev = acc[entry.entityId] ?? 0;
    if (ts > prev) acc[entry.entityId] = ts;
    return acc;
  }, {});

  const sortedDocumentsForList = [...filteredDocumentsForList].sort((a, b) => {
    const aActivityTs = latestActivityByDocument[a.id] ?? 0;
    const bActivityTs = latestActivityByDocument[b.id] ?? 0;
    if (aActivityTs !== bActivityTs) return bActivityTs - aActivityTs;

    const aUpdatedTs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdatedTs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (aUpdatedTs !== bUpdatedTs) return bUpdatedTs - aUpdatedTs;

    const aCreatedTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreatedTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreatedTs !== bCreatedTs) return bCreatedTs - aCreatedTs;

    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
  const recentDocumentsForList = sortedDocumentsForList.slice(0, HOME_RECENT_LIST_LIMIT);

  const getEditorDisplayName = (editorName?: string) => {
    const trimmedEditor = editorName?.trim();
    const trimmedCurrent = user?.name?.trim();
    if (
      trimmedEditor &&
      trimmedCurrent &&
      trimmedEditor.localeCompare(trimmedCurrent, "es", { sensitivity: "accent" }) === 0
    ) {
      return "Tú";
    }
    return trimmedEditor ?? "";
  };

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
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
              {quickNewDocError && (
                <p className="text-xs text-red-600 dark:text-red-400 text-right sm:max-w-sm">
                  {quickNewDocError}
                </p>
              )}
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto justify-stretch sm:justify-end">
                <Button
                  variant="primary"
                  icon={FileText}
                  loading={quickNewDocLoading}
                  onClick={() => void handleNewDocumentFromQuickActions()}
                  className="w-full sm:w-auto justify-center"
                >
                  Documento en blanco
                </Button>
                {user?.groupMemberships && user.groupMemberships.length > 0 ? (
                  <Link
                    to="/equipo"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full sm:w-auto"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.groupMemberships[0].group.name}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    icon={Users}
                    onClick={() => navigate("/equipo")}
                    className="w-full sm:w-auto justify-center"
                  >
                    Ver Equipo
                  </Button>
                )}
              </div>
            </div>
          }
        />

        {/* ── Stats Row ────────────────────────────────────────────────── */}
        {/*
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
        */}

        {/* ── Pendientes | Abierto | Compartidos (1/3 c/u) ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard title="Pendientes" noPadding className="min-h-[200px] max-h-[350px] overflow-y-auto flex flex-col" stickyHeader>
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
                          Asignaciones
                        </p>
                      </div>
                      {pendingAssignments.map((a) => {
                        const doc = a.document;
                        if (!doc) return null;
                        const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type ?? "DOCX");
                        const statusLabel = ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status;
                        return (
                          <div
                            key={`assign-${a.id}`}
                            onClick={() => navigate(getDocumentRoute(doc.id, doc.type))}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(getDocumentRoute(doc.id, doc.type));
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
                                {getViewerLabel({
                                  subjectId: a.assigner?.id,
                                  subjectName: a.assigner?.name,
                                  currentUserId: user?.id,
                                  fallback: "Asignado",
                                })}{" "}
                                · {statusLabel}
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

          {/* ── Compartidos recientemente ──────────────────────────────────── */}
          <SectionCard
            title="Compartidos recientemente"
            noPadding
            className="min-h-[200px] max-h-[350px] overflow-y-auto flex flex-col"
            stickyHeader
            action={
              <button
                type="button"
                onClick={refreshRecentlyShared}
                className="text-xs text-slate-400 hover:text-primary transition-colors"
                aria-label="Actualizar"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            }
          >
              {recentlySharedLoading ? (
                <div className="py-3 px-5 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-7 h-7 rounded-md shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4 rounded" />
                        <Skeleton className="h-2.5 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentlyShared.length === 0 ? (
                <div className="py-8 px-6 text-center">
                  <UserCheck className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sin compartidos
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {recentlyShared.map((item) => {
                    const inferredSubtype = (() => {
                      const rawSubtype = (item.entitySubtype ?? "").toUpperCase();
                      if (rawSubtype) return rawSubtype;
                      const lowerName = (item.entityName ?? "").toLowerCase();
                      if (lowerName.endsWith(".pdf")) return "PDF";
                      if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) return "DOCX";
                      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) return "XLSX";
                      return "DOCX";
                    })();
                    const isConvenio = item.entityType === 'convenio' || inferredSubtype === 'CONVENIO';
                    const { Icon: TypeIcon, color: typeColor, bg: typeBg } = isConvenio
                      ? { Icon: ScrollText, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20" }
                      : getFileTypeIcon(inferredSubtype);
                    const entitySubtype = inferredSubtype;
                    const sharedWithLower = (item.sharedWith ?? "").toLowerCase();
                    const sharedFormatFromMeta = (() => {
                      if (sharedWithLower.includes("pdf")) return "PDF";
                      if (sharedWithLower.includes("docx") || sharedWithLower.includes("word")) return "DOCX";
                      if (sharedWithLower.includes("xlsx") || sharedWithLower.includes("excel")) return "XLSX";
                      return null;
                    })();
                    const sharedAsKind = sharedFormatFromMeta ?? (isConvenio ? "CONVENIO" : entitySubtype || "ARCHIVO");
                    const sharedAsLabel = sharedAsKind === "CONVENIO" ? "Convenio" : sharedAsKind;
                    const sharedAsCls = sharedAsKind === "CONVENIO"
                      ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800'
                      : sharedAsKind === "PDF"
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                        : sharedAsKind === "DOCX"
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                          : sharedAsKind === "XLSX"
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
                    const sharedAsIcon = sharedAsKind === "CONVENIO"
                      ? <ScrollText className="w-2.5 h-2.5 shrink-0" />
                      : sharedAsKind === "PDF"
                        ? <FileText className="w-2.5 h-2.5 shrink-0" />
                        : sharedAsKind === "XLSX"
                          ? <Table className="w-2.5 h-2.5 shrink-0" />
                          : <FileText className="w-2.5 h-2.5 shrink-0" />;

                    const sharedAgo = (() => {
                      const diff = Date.now() - new Date(item.sharedAt).getTime();
                      const mins = Math.floor(diff / 60000);
                      const hrs = Math.floor(mins / 60);
                      const days = Math.floor(hrs / 24);
                      if (days > 0) return `Hace ${days}d`;
                      if (hrs > 0) return `Hace ${hrs}h`;
                      if (mins > 0) return `Hace ${mins}m`;
                      return 'Ahora';
                    })();

                    // Badge y jerarquía sharing-first
                    const methodBadge: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
                      email: { label: 'Email', icon: <Mail className="w-2.5 h-2.5 shrink-0" />, cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
                      whatsapp: { label: 'WhatsApp', icon: <MessageCircle className="w-2.5 h-2.5 shrink-0" />, cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
                      link: { label: 'Enlace', icon: <Link2 className="w-2.5 h-2.5 shrink-0" />, cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
                      system: { label: sharedAsLabel, icon: sharedAsIcon, cls: sharedAsCls },
                      other: { label: sharedAsLabel, icon: sharedAsIcon, cls: sharedAsCls },
                    };
                    const badge = methodBadge[item.shareMethod] ?? methodBadge.other;

                    const sharedByLabel = getViewerLabel({
                      subjectId: item.sharedBy?.id,
                      subjectName: item.sharedBy?.name,
                      currentUserId: user?.id,
                      fallback: "Sistema",
                    });
                    const genericPatterns = ['compartido via', 'enlace copiado', 'compartido', 'via sistema', 'system', 'a pdf', 'como pdf', 'a docx', 'como docx', 'a xlsx', 'como xlsx'];
                    const isGenericContact = genericPatterns.some(p => item.sharedWith.toLowerCase().includes(p));
                    const recipientLabel = isGenericContact ? null : item.sharedWith;
                    const sharedAtTime = new Date(item.sharedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={`share-${item.logId}`}
                        onClick={() => {
                          if (isConvenio) navigate(`/convenios/${item.entityId}`);
                          else navigate(getDocumentRoute(item.entityId, item.entitySubtype));
                        }}
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isConvenio) navigate(`/convenios/${item.entityId}`);
                            else navigate(getDocumentRoute(item.entityId, item.entitySubtype));
                          }
                        }}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeBg}`}>
                          <TypeIcon className={`w-4.5 h-4.5 ${typeColor}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${badge.cls} shrink-0`}>
                              {badge.icon}
                              {badge.label}
                            </span>
                            {recipientLabel && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Para {recipientLabel}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                            {item.entityName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Por <span className="font-medium text-slate-700 dark:text-slate-300">{sharedByLabel}</span>
                            <span className="text-slate-300 dark:text-slate-600"> · </span>
                            <Clock className="w-2.5 h-2.5 inline-block mr-1" />
                            {sharedAgo}
                            <span className="text-slate-300 dark:text-slate-600"> · </span>
                            {sharedAtTime}
                            {isConvenio && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600"> · </span>
                                Convenio
                              </>
                            )}
                          </p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              )}
          </SectionCard>

          <DashboardCalendar
            documents={documents}
            assignments={assignmentsReceived}
          />
        </div>

        <SectionCard title="Documentos recientes" noPadding className="overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/25">
            <FilterBar pills={filterPills} active={filter} onChange={setFilter} />
          </div>

          <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/60">
            <span>Documento</span>
            <span className="text-center whitespace-nowrap">Estado</span>
            <span className="sr-only">Acciones</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 lg:col-span-1">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <Skeleton className="h-4 w-3/4 max-w-md rounded" />
                      <Skeleton className="h-3 w-1/3 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-36 rounded-lg justify-self-end hidden lg:block" />
                  <Skeleton className="h-8 w-8 rounded-lg justify-self-end hidden lg:block" />
                </div>
              ))
            ) : recentDocumentsForList.length === 0 ? (
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
                      Documento en blanco
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {recentDocumentsForList.map((doc) => {
                  const { Icon: TypeIcon, color: typeColor, bg: typeBg } = getFileTypeIcon(doc.type);
                  const isExpiring = doc.fileStatus === "PENDIENTE" && doc.expirationDate;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleDocumentClick(doc)}
                      className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 hover:bg-slate-50/80 dark:hover:bg-slate-700/25 cursor-pointer transition-colors group lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-4 lg:items-center"
                      role="button"
                      tabIndex={0}
                      draggable={!!doc.id}
                      onDragStart={(e) => {
                        startDocDrag(e, {
                          id: doc.id,
                          name: doc.name,
                          type: doc.type,
                        });
                      }}
                      onDragEnd={() => endDocDrag()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleDocumentClick(doc);
                        }
                      }}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${typeBg}`}
                        >
                          <TypeIcon className={`w-4.5 h-4.5 ${typeColor}`} />
                        </div>

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
                                <span className="truncate">{getEditorDisplayName(doc.lastEditor)}</span>
                              </span>
                            )}
                            {isExpiring && (
                              <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium shrink-0">
                                <AlertCircle className="w-3 h-3" />
                                Vence {doc.expirationDate}
                              </span>
                            )}
                          </div>
                          {renderShareBadges(doc)}
                          {doc.assignments && doc.assignments.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {doc.assignments.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 max-w-full"
                                  title={`${getViewerLabel({
                                    subjectId: a.assignee.id,
                                    subjectName: a.assignee.name,
                                    currentUserId: user?.id,
                                    fallback: "Usuario",
                                  })} · ${ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}`}
                                >
                                  <UserAvatar
                                    name={a.assignee.name}
                                    avatarUrl={a.assignee.avatarUrl}
                                    className="w-4 h-4 rounded-full object-cover shrink-0"
                                  />
                                  <span className="font-medium truncate">{getViewerLabel({
                                    subjectId: a.assignee.id,
                                    subjectName: a.assignee.name,
                                    currentUserId: user?.id,
                                    fallback: "Usuario",
                                  })}</span>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                    {ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pl-12 sm:pl-[3.25rem] lg:pl-0 lg:contents">
                        <FileStatusIconToggle
                          className="shrink-0"
                          value={doc.fileStatus ?? "ACTIVO"}
                          disabled={!canChangeDocumentFileStatus(doc, user?.id)}
                          onChange={(status) => void handleSetFileStatus(doc, status)}
                        />

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <ActionMenu
                            items={buildDocumentActionMenuItems(doc, {
                              onOpen: () => handleDocumentClick(doc),
                              onShare: () => setShareDocument(doc),
                              onAssign: () => setAssignDocument(doc),
                              onPermissions: () => {
                                if (doc.currentUserPermission === "admin" || adminUnlockedForSession) {
                                  setPermissionsDocument(doc);
                                } else {
                                  setAdminAccessDocument(doc);
                                }
                              },
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
                    </div>
                  );
                })}

                <div
                  onClick={() => onOpenUploadModal?.()}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-t-2 border-dashed border-slate-200 dark:border-slate-700/60"
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
                      Documento en blanco
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

        {/* ── Actividad Reciente de Documentos (con polling en tiempo real) ── */}
        <SectionCard
          title=""
          noPadding
          className="overflow-hidden shadow-sm"
        >
          {/* Header custom con indicador "en vivo" */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/25">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Actividad Reciente</span>
              {/* Live indicator */}
              <span className="flex items-center gap-1 ml-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">En vivo</span>
              </span>
            </div>
            <button
              onClick={() => navigate('/bitacora')}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Ver todo
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {activityLoading && recentActivity.length === 0 ? (
              // Skeleton
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-2/3 rounded" />
                      <Skeleton className="h-2.5 w-1/3 rounded" />
                    </div>
                    <Skeleton className="h-2.5 w-10 rounded" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 px-6 text-center">
                <History className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin actividad de documentos esta semana</p>
              </div>
            ) : (
              recentActivity.map((entry) => {
                return (
                  <div key={entry.id} className="px-4 py-2.5">
                    <BitacoraEntryItem
                      entry={entry}
                      currentUserId={user?.id}
                      compact
                      onNavigate={navigate}
                    />
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {shareDocument && (
        <ShareModal
          document={shareDocument}
          onClose={() => setShareDocument(null)}
          onShareLogged={() => void onRefresh()}
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

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard onDone={() => setShowOnboarding(false)} />
      )}
    </>
  );
};
