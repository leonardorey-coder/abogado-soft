import React, { useState, useRef, useEffect, useCallback } from "react";
import { ViewState } from "../types";
import { activityApi, ApiActivityLog } from "../lib/api";

type PeriodFilter = "today" | "week" | "month" | "custom";

interface ActivityLogProps {
  onNavigate: (view: ViewState) => void;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatGroupDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function getGroupLabel(dateStr: string): { label: string; groupDate: string } {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d); dDate.setHours(0, 0, 0, 0);
  if (dDate.getTime() === today.getTime()) return { label: "Hoy", groupDate: formatGroupDate(today) };
  if (dDate.getTime() === yesterday.getTime()) return { label: "Ayer", groupDate: formatGroupDate(yesterday) };
  return { label: formatGroupDate(d), groupDate: "" };
}

function getActivityIcon(activity: string): { icon: string; iconBg: string; iconColor: string } {
  const lower = activity.toLowerCase();
  if (lower.includes("download") || lower.includes("descarg")) return { icon: "download", iconBg: "bg-blue-50 dark:bg-blue-900/30", iconColor: "text-primary" };
  if (lower.includes("upload") || lower.includes("sub") || lower.includes("creat")) return { icon: "upload_file", iconBg: "bg-purple-50 dark:bg-purple-900/30", iconColor: "text-purple-600" };
  if (lower.includes("update") || lower.includes("edit") || lower.includes("modif") || lower.includes("cambio")) return { icon: "rule", iconBg: "bg-green-50 dark:bg-green-900/30", iconColor: "text-green-600" };
  if (lower.includes("delete") || lower.includes("elimin")) return { icon: "delete", iconBg: "bg-red-50 dark:bg-red-900/30", iconColor: "text-red-600" };
  if (lower.includes("login") || lower.includes("auth") || lower.includes("sesion")) return { icon: "login", iconBg: "bg-teal-50 dark:bg-teal-900/30", iconColor: "text-teal-600" };
  if (lower.includes("share") || lower.includes("compart") || lower.includes("assign") || lower.includes("asign")) return { icon: "share", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600" };
  return { icon: "event", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-600" };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function getDateRange(period: PeriodFilter, customFrom: string, customTo: string): { from?: string; to?: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (period === "today") return { from: toYMD(today), to: toYMD(today) };
  if (period === "week") { const w = new Date(today); w.setDate(w.getDate() - 7); return { from: toYMD(w), to: toYMD(today) }; }
  if (period === "month") { const m = new Date(today.getFullYear(), today.getMonth(), 1); return { from: toYMD(m), to: toYMD(today) }; }
  if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  return {};
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ onNavigate }) => {
  const [activities, setActivities] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lawyerFilter, setLawyerFilter] = useState<string | null>(null);
  const [actionTypeFilter, setActionTypeFilter] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [openDropdown, setOpenDropdown] = useState<"lawyer" | "action" | null>(null);
  const lawyerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const fetchActivities = useCallback(async (pageNum: number, append = false) => {
    try {
      setLoading(true);
      const range = getDateRange(period, customFrom, customTo);
      const res = await activityApi.list({ page: pageNum, limit: 20, userId: lawyerFilter || undefined, activity: actionTypeFilter || undefined, ...range });
      if (append) setActivities(prev => [...prev, ...res.data]);
      else setActivities(res.data);
      setHasMore(res.pagination.page < res.pagination.totalPages);
    } catch (err) { console.error("Error cargando actividad:", err); } finally { setLoading(false); }
  }, [period, customFrom, customTo, lawyerFilter, actionTypeFilter]);

  useEffect(() => { setPage(1); fetchActivities(1); }, [fetchActivities]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchActivities(next, true);
  };

  const lawyers = Array.from(new Set(activities.filter(a => a.user).map(a => a.user!.name))).sort();
  const actionTypes = Array.from(new Set(activities.map(a => a.activity))).sort();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (lawyerRef.current?.contains(e.target as Node) || actionRef.current?.contains(e.target as Node)) return;
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Agrupar por fecha
  const grouped = activities.reduce<{ key: string; label: string; entries: ApiActivityLog[] }[]>((acc, entry) => {
    const dateKey = toYMD(new Date(entry.createdAt));
    const existing = acc.find(g => g.key === dateKey);
    const { label, groupDate } = getGroupLabel(entry.createdAt);
    const fullLabel = groupDate ? `${label} - ${groupDate}` : label;
    if (existing) existing.entries.push(entry);
    else acc.push({ key: dateKey, label: fullLabel, entries: [entry] });
    return acc;
  }, []).sort((a, b) => (a.key > b.key ? -1 : 1));

  return (
    <div className="relative flex flex-1 w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 flex flex-col space-y-8">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-2">
              <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
                <button type="button" className="hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>Inicio</button>
                <span>/</span><span className="text-[#111318] dark:text-white">Bitácora</span>
              </nav>
              <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Bitácora de Actividad</h1>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Historial de acciones en documentos y convenios del despacho.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-white dark:bg-gray-800 text-[#111318] dark:text-white text-sm font-bold border border-[#dbdfe6] dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span className="material-symbols-outlined text-lg">share</span><span className="truncate">Compartir</span>
              </button>
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors">
                <span className="material-symbols-outlined text-lg">download</span><span className="truncate">Exportar Reporte</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col flex-1 w-full">
            {/* Filter Section */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-[#dbdfe6] dark:border-gray-800 mb-8 p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div ref={lawyerRef} className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors" onClick={() => setOpenDropdown(v => v === "lawyer" ? null : "lawyer")}>
                    <div className="text-primary"><span className="material-symbols-outlined">person_search</span></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">Filtrar por</span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">{lawyerFilter ?? "Usuario"}</h2>
                    </div>
                    <span className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openDropdown === "lawyer" ? "rotate-180" : ""}`}>expand_more</span>
                    {openDropdown === "lawyer" && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                        <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setLawyerFilter(null); setOpenDropdown(null); }}>Todos</button>
                        {lawyers.map(name => (<button key={name} type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setLawyerFilter(name); setOpenDropdown(null); }}>{name}</button>))}
                      </div>
                    )}
                  </div>
                  <div ref={actionRef} className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors" onClick={() => setOpenDropdown(v => v === "action" ? null : "action")}>
                    <div className="text-primary"><span className="material-symbols-outlined">category</span></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">Filtrar por</span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">{actionTypeFilter ?? "Tipo de acción"}</h2>
                    </div>
                    <span className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openDropdown === "action" ? "rotate-180" : ""}`}>expand_more</span>
                    {openDropdown === "action" && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                        <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setActionTypeFilter(null); setOpenDropdown(null); }}>Todos</button>
                        {actionTypes.map(type => (<button key={type} type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setActionTypeFilter(type); setOpenDropdown(null); }}>{type}</button>))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-4">
                  <span className="text-xs font-bold text-[#616f89] uppercase tracking-wider mr-2">Periodo:</span>
                  {(["today", "week", "month", "custom"] as PeriodFilter[]).map(p => (
                    <button key={p} type="button" onClick={() => setPeriod(p)} className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === p ? "bg-primary/10 text-primary border border-primary/20" : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                      <p className="text-sm font-medium leading-normal">{p === "today" ? "Hoy" : p === "week" ? "Última semana" : p === "month" ? "Este mes" : "Personalizado"}</p>
                      {p === "custom" && <span className="material-symbols-outlined text-sm">calendar_today</span>}
                    </button>
                  ))}
                  {period === "custom" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
                      <span className="text-[#616f89]">a</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Activity Timeline */}
            <div className="relative flex flex-col gap-8 pl-2">
              <div className="absolute left-[20px] top-0 bottom-0 w-0.5 bg-[#dbdfe6] dark:bg-gray-700"></div>
              {loading && activities.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-6 w-full animate-pulse">
                      <div className="z-10 size-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : grouped.length === 0 ? (
                <div className="py-12 text-center text-[#616f89] dark:text-gray-400 text-sm">
                  <span className="material-symbols-outlined text-4xl block mb-2">search_off</span>
                  No hay actividad que coincida con los filtros.
                </div>
              ) : (
                grouped.map((group, groupIdx) => (
                  <div key={group.key} className="flex flex-col gap-4 relative">
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`z-10 size-3 rounded-full ml-[14.5px] border-4 border-white dark:border-background-dark ${groupIdx === 0 ? "bg-primary outline outline-1 outline-primary" : "bg-gray-400"}`}></div>
                      <h3 className="text-xs font-bold text-[#616f89] dark:text-gray-400 uppercase tracking-widest">{group.label}</h3>
                    </div>
                    {group.entries.map(entry => {
                      const { icon, iconBg, iconColor } = getActivityIcon(entry.activity);
                      return (
                        <div key={entry.id} className="flex items-start gap-6 relative group">
                          <div className={`z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor} border-2 border-white dark:border-background-dark shadow-sm`}>
                            <span className="material-symbols-outlined text-xl">{icon}</span>
                          </div>
                          <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-[#111318] dark:text-white font-medium">
                                <span className="font-bold">{entry.user?.name || "Sistema"}</span>{" "}
                                {entry.description || entry.activity}
                                {entry.entityName && (
                                  <> — <span className="italic text-primary cursor-pointer hover:underline">{entry.entityName}</span></>
                                )}
                              </p>
                              <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">{formatTime(entry.createdAt)}</span>
                            </div>
                            {entry.entityType && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-gray-400">{entry.entityType}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-primary">{entry.activity}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {/* Load More */}
            <div className="flex justify-center py-10">
              {hasMore && !loading && (
                <button onClick={handleLoadMore} className="flex items-center gap-2 text-primary font-bold text-sm hover:bg-primary/5 px-6 py-2 rounded-full transition-colors border border-primary/20">
                  <span className="material-symbols-outlined">history</span>Cargar actividad anterior
                </button>
              )}
              {loading && activities.length > 0 && (
                <div className="flex items-center gap-2 text-[#616f89]">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>Cargando...
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};