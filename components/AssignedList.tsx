import React, { useState, useEffect, useCallback } from "react";
import { ViewState, FileStatus } from "../types";
import { assignmentsApi, ApiDocumentAssignment } from "../lib/api";

interface AssignedListProps {
  onNavigate: (view: ViewState) => void;
}

const getFileStatusColor = (status: string) => {
  switch (status) {
    case "PENDING": case "PENDIENTE": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
    case "ACCEPTED": case "ACTIVO": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "COMPLETED": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "REJECTED": case "INACTIVO": return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600";
    default: return "bg-gray-100 text-gray-600";
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

const statusLabel = (s: string) => {
  switch (s) { case "PENDING": return "Pendiente"; case "ACCEPTED": return "Aceptado"; case "COMPLETED": return "Completado"; case "REJECTED": return "Rechazado"; default: return s; }
};

type FilterAssigned = "TODOS" | "PENDING" | "ACCEPTED" | "COMPLETED";

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

export const AssignedList: React.FC<AssignedListProps> = ({ onNavigate }) => {
  const [assignments, setAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterAssigned>("TODOS");

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await assignmentsApi.listReceived({ limit: 50, status: filter !== "TODOS" ? filter : undefined });
      setAssignments(res.data);
    } catch (err) { console.error("Error cargando asignaciones:", err); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const counts = {
    todos: assignments.length,
    pendientes: assignments.filter(a => a.status === "PENDING").length,
    revisados: assignments.filter(a => a.status === "ACCEPTED" || a.status === "COMPLETED").length,
    activos: assignments.filter(a => a.status === "ACCEPTED").length,
  };

  const filtered = filter === "TODOS" ? assignments : assignments.filter(a => a.status === filter);

  const handleDocumentClick = (a: ApiDocumentAssignment) => {
    const type = a.document?.type?.toUpperCase() || "";
    if (type === "XLSX" || type === "XLS") onNavigate(ViewState.EXCEL_EDITOR);
    else onNavigate(ViewState.EDITOR);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await assignmentsApi.updateStatus(id, status); fetchAssignments(); }
    catch (err) { console.error("Error actualizando estado:", err); }
  };

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-2">
        <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
          <button type="button" className="hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>Inicio</button>
          <span>/</span><span className="text-[#111318] dark:text-white">Asignados</span>
        </nav>
        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Documentos asignados</h1>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Documentos compartidos y asignados a usted.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2"><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Pendientes</p><span className="material-symbols-outlined text-primary">pending</span></div>
          <div className="flex items-baseline gap-2"><p className="text-3xl font-bold dark:text-white">{counts.pendientes}</p><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Por revisar</p></div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2"><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Revisados</p><span className="material-symbols-outlined text-primary">visibility</span></div>
          <div className="flex items-baseline gap-2"><p className="text-3xl font-bold dark:text-white">{counts.revisados}</p><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Aceptados o completados</p></div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2"><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Activos</p><span className="material-symbols-outlined text-primary">verified</span></div>
          <div className="flex items-baseline gap-2"><p className="text-3xl font-bold dark:text-white">{counts.activos}</p><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">En progreso</p></div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2"><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos asignados</p><span className="material-symbols-outlined text-primary">description</span></div>
          <div className="flex items-baseline gap-2"><p className="text-3xl font-bold dark:text-white">{counts.todos}</p><p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Total en lista</p></div>
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
          <span className="material-symbols-outlined text-primary">history</span>Asignados recientes
        </h3>
      </div>

      <div className="flex gap-4 flex-wrap overflow-x-auto pb-2">
        {([
          { key: "TODOS" as FilterAssigned, label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
          { key: "PENDING" as FilterAssigned, label: "Pendientes", count: counts.pendientes, icon: "pending", color: "text-orange-600" },
          { key: "ACCEPTED" as FilterAssigned, label: "Aceptados", count: counts.revisados, icon: "visibility", color: "text-blue-600" },
          { key: "COMPLETED" as FilterAssigned, label: "Completados", count: assignments.filter(a => a.status === "COMPLETED").length, icon: "verified", color: "text-green-600" },
        ]).map(pill => (
          <button key={pill.key} type="button" onClick={() => setFilter(pill.key)} className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === pill.key ? "bg-primary text-white" : "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}>
            <span className={`material-symbols-outlined text-xl ${filter === pill.key ? "text-white" : pill.color}`}>{pill.icon}</span>
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between mb-4"><div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 block mb-2">folder_off</span>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No hay documentos asignados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="Lista de documentos asignados">
          {filtered.map((a) => {
            const docType = a.document?.type || "docx";
            const { icon, color } = getFileIcon(docType);
            const isPending = a.status === "PENDING";

            return (
              <article key={a.id} role="listitem" onClick={() => handleDocumentClick(a)} className="min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all cursor-pointer group shadow-sm relative flex flex-col h-full">
                <header className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-4 ${color} rounded-xl shrink-0`} aria-hidden><span className="material-symbols-outlined text-[32px] font-bold">{icon}</span></div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase border ${getFileStatusColor(a.status)}`}>{statusLabel(a.status)}</span>
                  </div>
                </header>
                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {(a.document?.name || "Documento").split("_").map((part, i) => i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>)}
                </h3>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">
                  <span className="material-symbols-outlined text-lg shrink-0">person</span>
                  <span>De: {a.assigner?.name || "Desconocido"}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-3">
                  <span className="material-symbols-outlined text-lg shrink-0">calendar_today</span>
                  <span>{formatTimeAgo(a.createdAt)} · {formatDate(a.createdAt)}</span>
                </p>
                {a.dueDate && (
                  <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-100 dark:border-red-900/50" role="alert">
                    <span className="material-symbols-outlined text-lg shrink-0">warning</span>
                    <span className="text-xs font-bold">Vence el {formatDate(a.dueDate)}</span>
                  </div>
                )}
                {a.notes && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 italic">"{a.notes}"</p>}
                <footer className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDocumentClick(a); }} className="flex-1 min-h-[44px] py-3 bg-primary hover:opacity-90 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">visibility</span>Ver
                  </button>
                  {isPending && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(a.id, "ACCEPTED"); }} className="min-h-[44px] py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-lg">check</span>
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {assignments.length > 0 && (
        <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">
          Mostrando {filtered.length} de {assignments.length} documento{assignments.length !== 1 ? "s" : ""} asignado{assignments.length !== 1 ? "s" : ""}
          {filter !== "TODOS" ? " (filtrado)" : ""}.
        </p>
      )}
    </main>
  );
};
