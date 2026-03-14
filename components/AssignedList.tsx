import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { assignmentsApi, ApiDocumentAssignment } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";

const getStatusStyle = (status: string) => {
  switch (status) {
    case "pendiente": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
    case "visto": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "editado": return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
    case "completado": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "rechazado": return "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    case "revisado": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "pendiente": return "Pendiente";
    case "visto": return "Visto";
    case "editado": return "Editado";
    case "completado": return "Completado";
    case "rechazado": return "Rechazado";
    case "revisado": return "Revisado";
    default: return s;
  }
};

const statusIcon = (s: string) => {
  switch (s) {
    case "pendiente": return "schedule";
    case "visto": return "visibility";
    case "editado": return "edit_note";
    case "completado": return "check_circle";
    case "rechazado": return "cancel";
    case "revisado": return "fact_check";
    default: return "help";
  }
};

const getFileIcon = (type: string) => {
  switch (type?.toUpperCase()) {
    case "DOCX": case "DOC": return { icon: "description", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    case "PDF": return { icon: "picture_as_pdf", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    case "XLSX": case "XLS": return { icon: "table_view", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" };
    default: return { icon: "article", color: "bg-slate-100 text-slate-600" };
  }
};

type FilterAssigned = "TODOS" | "pendiente" | "visto" | "editado" | "completado" | "rechazado";
type TabAssigned = "RECIBIDOS" | "ENVIADOS";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 7)}w`;
}

function isOverdue(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export const AssignedList: React.FC = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterAssigned>("TODOS");
  const [tab, setTab] = useState<TabAssigned>("RECIBIDOS");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = filter !== "TODOS" ? filter : undefined;
      const fetchFn = tab === "RECIBIDOS" ? assignmentsApi.listReceived : assignmentsApi.listSent;
      const res = await fetchFn({ limit: 100, status: statusParam });
      setAssignments(res.data);

      // Fetch all (no filter) for accurate counts
      if (filter !== "TODOS") {
        const allRes = await fetchFn({ limit: 100 });
        setAllAssignments(allRes.data);
      } else {
        setAllAssignments(res.data);
      }
    } catch (err) {
      console.error("Error cargando asignaciones:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, tab]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const counts = {
    todos: allAssignments.length,
    pendientes: allAssignments.filter(a => a.status === "pendiente").length,
    vistos: allAssignments.filter(a => a.status === "visto").length,
    editados: allAssignments.filter(a => a.status === "editado").length,
    completados: allAssignments.filter(a => a.status === "completado").length,
    rechazados: allAssignments.filter(a => a.status === "rechazado").length,
  };

  const handleDocumentClick = (a: ApiDocumentAssignment) => {
    const doc = a.document;
    if (doc?.id) navigate(getDocumentRoute(doc.id, doc.type));
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      await assignmentsApi.updateStatus(id, status);
      await fetchAssignments();
    } catch (err: any) {
      console.error("Error actualizando estado:", err);
      const msg = err?.message || "Error al actualizar estado.";
      alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas revocar y eliminar esta asignación?")) return;
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

  const pills: { key: FilterAssigned; label: string; count: number; icon: string; color: string }[] = [
    { key: "TODOS", label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
    { key: "pendiente", label: "Pendientes", count: counts.pendientes, icon: "schedule", color: "text-amber-600" },
    { key: "visto", label: "Vistos", count: counts.vistos, icon: "visibility", color: "text-blue-600" },
    { key: "editado", label: "Editados", count: counts.editados, icon: "edit_note", color: "text-indigo-600" },
    { key: "completado", label: "Completados", count: counts.completados, icon: "check_circle", color: "text-green-600" },
    { key: "rechazado", label: "Rechazados", count: counts.rechazados, icon: "cancel", color: "text-red-600" },
  ];

  // Can the assignee take action?
  const canComplete = (s: string) => ["visto", "editado"].includes(s);
  const canReject = (s: string) => ["pendiente", "visto", "editado"].includes(s);
  const isTerminal = (s: string) => ["completado", "rechazado"].includes(s);

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-2">
        <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <span>/</span><span className="text-[#111318] dark:text-white">Asignados</span>
        </nav>
        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Documentos Asignados</h1>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Gestiona las asignaciones de documentos.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Pendientes", count: counts.pendientes, icon: "schedule", color: "text-amber-500" },
          { label: "Vistos", count: counts.vistos, icon: "visibility", color: "text-blue-500" },
          { label: "Editados", count: counts.editados, icon: "edit_note", color: "text-indigo-500" },
          { label: "Completados", count: counts.completados, icon: "check_circle", color: "text-green-500" },
          { label: "Rechazados", count: counts.rechazados, icon: "cancel", color: "text-red-500" },
          { label: "Total", count: counts.todos, icon: "description", color: "text-primary" },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-[#1a212f] p-2.5 sm:p-3 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <p className="text-[#616f89] dark:text-[#a0aec0] text-[10px] sm:text-xs font-medium truncate pr-1">{card.label}</p>
              <span className={`material-symbols-outlined text-sm sm:text-base shrink-0 ${card.color}`}>{card.icon}</span>
            </div>
            <p className="text-lg sm:text-xl font-bold dark:text-white leading-none">{card.count}</p>
          </div>
        ))}
      </div>

      {/* Tab selector */}
      <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
          <span className="material-symbols-outlined text-primary">assignment</span>Listado de Asignaciones
        </h3>

        <div className="relative isolate flex p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
          {/* Sliding background pill */}
          <div
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-transform duration-300 ease-out z-[-1]"
            style={{
              transform: `translateX(${tab === "RECIBIDOS" ? "0%" : "100%"})`
            }}
          />
          <button
            onClick={() => { setTab("RECIBIDOS"); setFilter("TODOS"); }}
            className={`flex-1 px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-300 w-32 ${tab === "RECIBIDOS" ? "text-primary" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            Mis Asignaciones
          </button>
          <button
            onClick={() => { setTab("ENVIADOS"); setFilter("TODOS"); }}
            className={`flex-1 px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-300 w-32 ${tab === "ENVIADOS" ? "text-primary" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            Enviados
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {pills.map(pill => (
          <button key={pill.key} type="button" onClick={() => setFilter(pill.key)} className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-bold shadow-sm transition-all whitespace-nowrap ${filter === pill.key ? "bg-primary text-white" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}>
            <span className={`material-symbols-outlined text-[14px] sm:text-[16px] ${filter === pill.key ? "text-white" : pill.color}`}>{pill.icon}</span>
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between mb-4"><div className="h-12 w-12 sm:h-16 sm:w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-8 sm:p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 block mb-2">folder_off</span>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No hay documentos asignados en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" role="list">
          {assignments.map((a) => {
            const docType = a.document?.type || "docx";
            const { icon, color } = getFileIcon(docType);
            const overdue = isOverdue(a.dueDate) && !isTerminal(a.status);
            const isUpdating = updatingId === a.id;

            return (
              <article key={a.id} role="listitem" onClick={() => handleDocumentClick(a)} className={`min-w-0 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer group shadow-sm relative flex flex-col h-full ${overdue ? "border-red-300 dark:border-red-800" : "border-slate-100 dark:border-slate-700 hover:border-primary"}`}>
                <header className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                  <div className={`p-3 sm:p-4 ${color} rounded-xl shrink-0`} aria-hidden><span className="material-symbols-outlined text-[24px] sm:text-[32px] font-bold">{icon}</span></div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] font-black uppercase border ${getStatusStyle(a.status)}`}>
                      <span className="material-symbols-outlined text-[10px] sm:text-xs">{statusIcon(a.status)}</span>
                      {statusLabel(a.status)}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">warning</span>VENCIDO
                      </span>
                    )}
                  </div>
                </header>
                <h3 className="text-lg sm:text-xl font-extrabold mb-2 sm:mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {(a.document?.name || "Documento").split("_").map((part, i) => i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>)}
                </h3>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mb-1">
                  <span className="material-symbols-outlined text-base sm:text-lg shrink-0">{tab === "RECIBIDOS" ? "person" : "person_check"}</span>
                  <span>{tab === "RECIBIDOS" ? `De: ${a.assigner?.name || "Desconocido"}` : `Para: ${a.assignee?.name || "Desconocido"}`}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mb-2 sm:mb-3">
                  <span className="material-symbols-outlined text-base sm:text-lg shrink-0">calendar_today</span>
                  <span>{formatTimeAgo(a.createdAt)} · {formatDate(a.createdAt)}</span>
                </p>
                {a.dueDate && (
                  <div className={`mb-2 sm:mb-3 flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border text-[10px] sm:text-xs font-bold ${overdue ? "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50" : "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50"}`} role="alert">
                    <span className="material-symbols-outlined text-sm sm:text-lg shrink-0">{overdue ? "warning" : "event"}</span>
                    <span>{overdue ? "Venció" : "Vence"} el {formatDate(a.dueDate)}</span>
                  </div>
                )}
                {a.notes && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-2 sm:mb-3 italic line-clamp-2">"{a.notes}"</p>}

                <footer className="mt-auto pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                  {/* View button – always available */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDocumentClick(a); }} className="flex-1 min-h-[36px] sm:min-h-[44px] py-2 sm:py-3 bg-primary hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2">
                    <span className="material-symbols-outlined text-base sm:text-lg">visibility</span>Ver
                  </button>

                  {tab === "RECIBIDOS" && !isTerminal(a.status) && (
                    <>
                      {canComplete(a.status) && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(a.id, "completado"); }}
                          className="min-h-[36px] sm:min-h-[44px] py-2 px-3 sm:py-3 sm:px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1"
                          title="Marcar como completado"
                        >
                          <span className="material-symbols-outlined text-base sm:text-lg">{isUpdating ? "sync" : "check_circle"}</span>
                        </button>
                      )}
                      {canReject(a.status) && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(a.id, "rechazado"); }}
                          className="min-h-[36px] sm:min-h-[44px] py-2 px-3 sm:py-3 sm:px-4 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1"
                          title="Rechazar asignación"
                        >
                          <span className="material-symbols-outlined text-base sm:text-lg">{isUpdating ? "sync" : "close"}</span>
                        </button>
                      )}
                    </>
                  )}

                  {tab === "ENVIADOS" && (
                    <button type="button" disabled={isUpdating} onClick={(e) => { e.stopPropagation(); handleRevoke(a.id); }} className="min-h-[36px] sm:min-h-[44px] py-2 px-3 sm:py-3 sm:px-4 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2" title="Revocar asignación">
                      <span className="material-symbols-outlined text-base sm:text-lg">block</span>
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {allAssignments.length > 0 && (
        <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">
          Mostrando {assignments.length} de {allAssignments.length} documento{allAssignments.length !== 1 ? "s" : ""} asignado{allAssignments.length !== 1 ? "s" : ""}
          {filter !== "TODOS" ? " (filtrado)" : ""}.
        </p>
      )}
    </main>
  );
};
