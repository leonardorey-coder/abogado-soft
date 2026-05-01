import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { assignmentsApi, documentsApi, type ApiDocumentAssignment } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";
import { startDocDrag, endDocDrag } from "../lib/docDrag";
import { CloudDocThumbnail } from "./CloudDocThumbnail";
import { DocumentTypeFilter, type DocumentTypeCounts, type DocumentTypeFilterValue } from "./DocumentTypeFilter";
import { Skeleton } from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { getViewerLabel } from "../lib/viewerIdentity";
import { AssignModal } from "./AssignModal";
import { type Document, type FileStatus } from "../types";
import { useToast } from "../contexts/ToastContext";
import { FileStatusIconToggle } from "./FileStatusIconToggle";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  Eye,
  FolderOpen,
  MessageSquare,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterAssigned = "TODOS" | "pendiente" | "visto" | "editado" | "completado" | "rechazado";
type TabAssigned = "RECIBIDOS" | "ENVIADOS";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; cls: string; tabCls: string; Icon: React.ElementType }
> = {
  pendiente: {
    label: "Pendiente",
    cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    tabCls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Icon: Clock,
  },
  visto: {
    label: "Visto",
    cls: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    tabCls: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Icon: Eye,
  },
  editado: {
    label: "Editado",
    cls: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    tabCls: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    Icon: Edit2,
  },
  completado: {
    label: "Completado",
    cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
    tabCls: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
    Icon: CheckCircle2,
  },
  rechazado: {
    label: "Rechazado",
    cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
    tabCls: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
    Icon: XCircle,
  },
  revisado: {
    label: "Revisado",
    cls: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    tabCls: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Icon: CheckCircle2,
  },
};

const fallbackStatus = {
  label: "Desconocido",
  cls: "border-slate-200 bg-slate-100 text-slate-500",
  tabCls: "border-slate-200 bg-slate-100 text-slate-500",
  Icon: Clock,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 7)}sem`;
}

function isOverdue(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

const isTerminal = (s: string) => ["completado", "rechazado"].includes(s);
const canComplete = (s: string) => ["visto", "editado"].includes(s);
const canReject = (s: string) => ["pendiente", "visto", "editado"].includes(s);

function getAssignmentDocumentType(assignment: ApiDocumentAssignment): DocumentTypeFilterValue | null {
  const type = assignment.document?.type?.toUpperCase();
  if (type === "DOC" || type === "DOCX" || type === "TXT" || type === "RTF") return "DOCX";
  if (type === "XLS" || type === "XLSX") return "XLSX";
  if (type === "PDF") return "PDF";
  return null;
}

function mapAssignmentToDocument(assignment: ApiDocumentAssignment): Document | null {
  const doc = assignment.document;
  if (!doc) return null;
  const type = doc.type?.toUpperCase();
  if (type !== "DOCX" && type !== "PDF" && type !== "XLSX") return null;
  const fs = doc.fileStatus as FileStatus | undefined;
  return {
    id: doc.id,
    name: doc.name,
    type,
    lastModified: formatDate(doc.updatedAt || assignment.createdAt),
    timeAgo: formatTimeAgo(doc.updatedAt || assignment.createdAt),
    fileStatus: fs === "PENDIENTE" || fs === "INACTIVO" ? fs : "ACTIVO",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function patchAssignmentsDocFileStatus(
  list: ApiDocumentAssignment[],
  docId: string,
  status: FileStatus,
): ApiDocumentAssignment[] {
  return list.map((a) => {
    if (a.document?.id !== docId) return a;
    return {
      ...a,
      document: { ...a.document, fileStatus: status },
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AssignedList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterAssigned>("TODOS");
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilterValue>("TODOS");
  const [tab, setTab] = useState<TabAssigned>("RECIBIDOS");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const fetchFn = tab === "RECIBIDOS" ? assignmentsApi.listReceived : assignmentsApi.listSent;
      const res = await fetchFn({ limit: 100 });
      const all = res.data;
      setAllAssignments(all);
      setAssignments(
        all.filter((assignment) => {
          const matchesStatus = filter === "TODOS" || assignment.status === filter;
          const matchesType = typeFilter === "TODOS" || getAssignmentDocumentType(assignment) === typeFilter;
          return matchesStatus && matchesType;
        }),
      );
    } catch (err) {
      console.error("Error cargando asignaciones:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, tab, typeFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchAssignments();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchAssignments]);

  const assignmentsForStatusCounts = typeFilter === "TODOS"
    ? allAssignments
    : allAssignments.filter((a) => getAssignmentDocumentType(a) === typeFilter);

  const counts = {
    todos: assignmentsForStatusCounts.length,
    pendientes: assignmentsForStatusCounts.filter((a) => a.status === "pendiente").length,
    vistos: assignmentsForStatusCounts.filter((a) => a.status === "visto").length,
    editados: assignmentsForStatusCounts.filter((a) => a.status === "editado").length,
    completados: assignmentsForStatusCounts.filter((a) => a.status === "completado").length,
    rechazados: assignmentsForStatusCounts.filter((a) => a.status === "rechazado").length,
  };

  const typeCounts: DocumentTypeCounts = {
    TODOS: allAssignments.length,
    DOCX: allAssignments.filter((a) => getAssignmentDocumentType(a) === "DOCX").length,
    XLSX: allAssignments.filter((a) => getAssignmentDocumentType(a) === "XLSX").length,
    PDF: allAssignments.filter((a) => getAssignmentDocumentType(a) === "PDF").length,
  };

  const handleDocumentClick = (a: ApiDocumentAssignment) => {
    const doc = a.document;
    if (!doc?.id) return;
    setOpeningId(a.id);
    setTimeout(() => {
      navigate(getDocumentRoute(doc.id, doc.type));
      setOpeningId(null);
    }, 250);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      await assignmentsApi.updateStatus(id, status);
      await fetchAssignments();
    } catch (err: any) {
      console.error("Error actualizando estado:", err);
      alert(err?.message || "Error al actualizar estado.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDocumentFileStatus = async (docId: string, status: FileStatus) => {
    const fromAll = allAssignments.find((a) => a.document?.id === docId);
    const previous = (fromAll?.document?.fileStatus as FileStatus | undefined) ?? "ACTIVO";
    if (previous === status) return;
    setAllAssignments((prev) => patchAssignmentsDocFileStatus(prev, docId, status));
    setAssignments((prev) => patchAssignmentsDocFileStatus(prev, docId, status));
    try {
      await documentsApi.update(docId, { fileStatus: status });
    } catch {
      setAllAssignments((prev) => patchAssignmentsDocFileStatus(prev, docId, previous));
      setAssignments((prev) => patchAssignmentsDocFileStatus(prev, docId, previous));
      addToast({ message: "No se pudo actualizar el estado del archivo.", type: "error" });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("¿Revocar y eliminar esta asignación?")) return;
    try {
      setUpdatingId(id);
      await assignmentsApi.delete(id);
      await fetchAssignments();
    } catch (err: any) {
      console.error("Error al revocar:", err);
      alert(err?.message || "Error al revocar asignación");
    } finally {
      setUpdatingId(null);
    }
  };

  const pills: {
    key: FilterAssigned;
    label: string;
    count: number;
    icon: string;
    color: string;
  }[] = [
    { key: "TODOS", label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
    { key: "pendiente", label: "Pendientes", count: counts.pendientes, icon: "schedule", color: "text-amber-600" },
    { key: "visto", label: "Vistos", count: counts.vistos, icon: "visibility", color: "text-blue-600" },
    { key: "editado", label: "Editados", count: counts.editados, icon: "edit_note", color: "text-indigo-600" },
    { key: "completado", label: "Completados", count: counts.completados, icon: "check_circle", color: "text-green-600" },
    { key: "rechazado", label: "Rechazados", count: counts.rechazados, icon: "cancel", color: "text-red-600" },
  ];

  return (
    <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <nav className="flex gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-primary transition-colors">
              Inicio
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white">Asignados</span>
          </nav>
          <h1 className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight">
            Documentos asignados
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Gestiona las asignaciones de documentos de tu despacho.
          </p>
        </div>
      </div>

      {/* Tab slider */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative isolate flex p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl self-start">
          <div
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${tab === "RECIBIDOS" ? "0%" : "100%"})` }}
          />
          <button
            type="button"
            onClick={() => { setTab("RECIBIDOS"); setFilter("TODOS"); }}
            className={`relative z-10 flex items-center gap-1.5 px-5 py-2 font-bold text-sm rounded-lg transition-colors duration-300 w-36 justify-center ${
              tab === "RECIBIDOS"
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Recibidos
          </button>
          <button
            type="button"
            onClick={() => { setTab("ENVIADOS"); setFilter("TODOS"); }}
            className={`relative z-10 flex items-center gap-1.5 px-5 py-2 font-bold text-sm rounded-lg transition-colors duration-300 w-36 justify-center ${
              tab === "ENVIADOS"
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Enviados
          </button>
        </div>

        {allAssignments.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {assignments.length} de {allAssignments.length} asignación
            {allAssignments.length !== 1 ? "es" : ""}
            {filter !== "TODOS" || typeFilter !== "TODOS" ? " (filtrado)" : ""}
          </p>
        )}
      </div>

      {/* Pills */}
      <div className="flex flex-wrap items-end gap-3">
        <DocumentTypeFilter value={typeFilter} onChange={setTypeFilter} counts={typeCounts} />
        <div className="flex gap-2 items-center overflow-x-auto no-scrollbar flex-1 min-w-0">
          {pills.map((pill) => (
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
              <span
                className={`material-symbols-outlined text-[18px] leading-none ${
                  filter === pill.key ? "" : pill.color
                }`}
              >
                {pill.icon}
              </span>
              {pill.label} ({pill.count})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 overflow-hidden"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
                <Skeleton className="h-2.5 w-2/3 rounded" />
                <Skeleton className="h-9 w-full rounded-xl mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="py-16 text-center">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            No hay asignaciones
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {filter !== "TODOS"
              ? "No hay asignaciones en esta categoría."
              : tab === "RECIBIDOS"
                ? "Aún no te han asignado documentos."
                : "Aún no has enviado asignaciones."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => {
            const doc = a.document;
            const overdue = isOverdue(a.dueDate) && !isTerminal(a.status);
            const canReassign = tab === "ENVIADOS" && !!doc && (a.status === "rechazado" || isOverdue(a.dueDate));
            const isUpdating = updatingId === a.id;
            const isOpening = openingId === a.id;
            const sc = statusConfig[a.status] ?? fallbackStatus;
            const StatusIcon = sc.Icon;

            return (
              <article
                key={a.id}
                className={`group relative mt-3 cursor-pointer rounded-2xl border bg-white shadow-sm transition-colors hover:border-primary/40 hover:bg-slate-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 flex flex-col ${
                  overdue
                    ? "border-red-300 dark:border-red-700/60"
                    : "border-slate-200 dark:border-slate-700/60"
                }`}
                onClick={() => handleDocumentClick(a)}
                role="button"
                tabIndex={0}
                draggable={!!doc}
                onDragStart={(e) => {
                  if (!doc) return;
                  startDocDrag(e, { id: doc.id, name: doc.name, type: doc.type });
                }}
                onDragEnd={() => endDocDrag()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDocumentClick(a);
                  }
                }}
              >
                {/* Pestaña de estado */}
                <div
                  className={`absolute left-4 top-0 z-10 -translate-y-full rounded-t-lg border border-b-0 px-2.5 py-0.5 text-[11px] font-semibold ${sc.tabCls}`}
                >
                  {sc.label}
                </div>

                {/* Thumbnail */}
                <div className="relative">
                  {doc ? (
                    <CloudDocThumbnail doc={doc} />
                  ) : (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl border-b border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
                      <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1 bg-gradient-to-t from-black/20 to-transparent pointer-events-none">
                        <p className="text-[10px] font-bold text-white/90">ASIGNACIÓN</p>
                      </div>
                    </div>
                  )}

                  {/* Badge estado esquina */}
                  <div
                    className={`absolute right-2 top-2 z-10 rounded-md border p-1 ${sc.cls}`}
                    title={sc.label}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                  </div>

                  {/* Badge vencido */}
                  {overdue && (
                    <div
                      className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 dark:border-red-700 dark:bg-red-900/30"
                      title="Asignación vencida"
                    >
                      <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                      <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-400">Vencido</span>
                    </div>
                  )}

                  {/* Spinner apertura */}
                  {isOpening && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px]">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col gap-2 p-3 flex-1">
                  {/* Nombre documento */}
                  <p
                    className="text-sm font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2"
                    title={doc?.name}
                  >
                    {(doc?.name || "Sin documento").split("_").map((part, i) =>
                      i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>,
                    )}
                  </p>

                  {/* Meta */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      {tab === "RECIBIDOS" ? (
                        <User className="h-3 w-3 shrink-0" />
                      ) : (
                        <UserCheck className="h-3 w-3 shrink-0" />
                      )}
                      {tab === "RECIBIDOS" ? (
                        <span>
                          De:{" "}
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {getViewerLabel({
                              subjectId: a.assigner?.id,
                              subjectName: a.assigner?.name,
                              currentUserId: user?.id,
                              fallback: "Desconocido",
                            })}
                          </span>
                        </span>
                      ) : (
                        <span>
                          Para:{" "}
                          {a.assignee?.id ? (
                            <Link
                              to={`/equipo/usuario/${a.assignee.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              {getViewerLabel({
                                subjectId: a.assignee?.id,
                                subjectName: a.assignee?.name,
                                currentUserId: user?.id,
                                fallback: "Desconocido",
                              })}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {getViewerLabel({
                                subjectId: a.assignee?.id,
                                subjectName: a.assignee?.name,
                                currentUserId: user?.id,
                                fallback: "Desconocido",
                              })}
                            </span>
                          )}
                        </span>
                      )}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {formatTimeAgo(a.createdAt)} · {formatDate(a.createdAt)}
                    </span>

                    {a.dueDate && (
                      <span
                        className={`flex items-center gap-1.5 font-semibold ${
                          overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        <CalendarClock className="h-3 w-3 shrink-0" />
                        {overdue ? "Venció" : "Vence"} {formatDate(a.dueDate)}
                      </span>
                    )}

                    {a.notes && (
                      <span className="flex items-start gap-1.5 italic">
                        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">"{a.notes}"</span>
                      </span>
                    )}
                  </div>

                  {doc && (
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <FileStatusIconToggle
                        value={
                          doc.fileStatus === "PENDIENTE" || doc.fileStatus === "INACTIVO"
                            ? doc.fileStatus
                            : "ACTIVO"
                        }
                        onChange={(s) => void handleDocumentFileStatus(doc.id, s)}
                      />
                    </div>
                  )}

                  {/* Footer acciones */}
                  <div
                    className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/60 flex gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleDocumentClick(a)}
                      className="flex-1 min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </button>

                    {tab === "RECIBIDOS" && !isTerminal(a.status) && (
                      <>
                        {canComplete(a.status) && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(a.id, "completado")}
                            className="min-h-[34px] px-3 inline-flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                            title="Marcar completado"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canReject(a.status) && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(a.id, "rechazado")}
                            className="min-h-[34px] px-3 inline-flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-xs font-bold transition-colors"
                            title="Rechazar"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}

                    {tab === "ENVIADOS" && (
                      <>
                        {canReassign && (
                          <button
                            type="button"
                            onClick={() => {
                              const mappedDocument = mapAssignmentToDocument(a);
                              if (!mappedDocument) return;
                              setAssignDocument(mappedDocument);
                            }}
                            className="min-h-[34px] px-3 inline-flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-300 text-xs font-bold transition-colors"
                            title="Reasignar documento"
                          >
                            Reasignar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRevoke(a.id)}
                          className="min-h-[34px] px-3 inline-flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-xs font-bold transition-colors"
                          title="Revocar asignación"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {assignDocument && (
        <AssignModal
          document={assignDocument}
          onClose={() => {
            setAssignDocument(null);
            void fetchAssignments();
          }}
        />
      )}
    </main>
  );
};
