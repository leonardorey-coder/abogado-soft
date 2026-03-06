import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { activityApi, ApiActivityLog } from "../lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type PeriodFilter = "today" | "week" | "month" | "custom";
type CategoryTab = "all" | "documents" | "convenios" | "team" | "security" | "assignments";

interface CategoryDef {
  key: CategoryTab;
  label: string;
  icon: string;
  colorClass: string;
  badgeBg: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: "all", label: "Todos", icon: "history", colorClass: "text-slate-700 dark:text-slate-300", badgeBg: "bg-slate-100 dark:bg-slate-800" },
  { key: "documents", label: "Documentos", icon: "description", colorClass: "text-blue-700 dark:text-blue-400", badgeBg: "bg-blue-50 dark:bg-blue-900/30" },
  { key: "convenios", label: "Convenios", icon: "handshake", colorClass: "text-amber-700 dark:text-amber-400", badgeBg: "bg-amber-50 dark:bg-amber-900/30" },
  { key: "team", label: "Equipo", icon: "groups", colorClass: "text-indigo-700 dark:text-indigo-400", badgeBg: "bg-indigo-50 dark:bg-indigo-900/30" },
  { key: "security", label: "Seguridad", icon: "shield", colorClass: "text-red-700 dark:text-red-400", badgeBg: "bg-red-50 dark:bg-red-900/30" },
  { key: "assignments", label: "Asignados", icon: "assignment", colorClass: "text-purple-700 dark:text-purple-400", badgeBg: "bg-purple-50 dark:bg-purple-900/30" },
];

// ─── Activity name mapping ──────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  LOGIN: "Inició sesión",
  LOGOUT: "Cerró sesión",
  DOCUMENT_CREATED: "Creó documento",
  DOCUMENT_UPDATED: "Editó documento",
  DOCUMENT_DELETED: "Eliminó documento",
  DOCUMENT_RESTORED: "Restauró documento",
  DOCUMENT_SHARED: "Compartió documento",
  DOCUMENT_ASSIGNED: "Asignó documento",
  DOCUMENT_DOWNLOADED: "Descargó documento",
  DOCUMENT_EXTRACTED: "Extrajo documento",
  DOCUMENT_PERMISSION_CHANGED: "Cambió permisos",
  DOCUMENT_VERSION_CREATED: "Creó versión",
  DOCUMENT_COMMENT_ADDED: "Comentó documento",
  DOCUMENT_COMMENT_DELETED: "Eliminó comentario",
  CONVENIO_CREATED: "Creó convenio",
  CONVENIO_UPDATED: "Editó convenio",
  CONVENIO_DELETED: "Eliminó convenio",
  CONVENIO_VERSION_CREATED: "Creó versión de convenio",
  CONVENIO_COMMENT_ADDED: "Comentó convenio",
  CONVENIO_COMMENT_DELETED: "Eliminó comentario de convenio",
  GROUP_CREATED: "Creó grupo",
  GROUP_UPDATED: "Editó grupo",
  GROUP_DELETED: "Eliminó grupo",
  GROUP_MEMBER_ADDED: "Agregó miembro",
  GROUP_MEMBER_REMOVED: "Removió miembro",
  ADMIN_ACCESS_GRANTED: "Concedió acceso admin",
  ADMIN_ACCESS_DENIED: "Denegó acceso admin",
  BACKUP_CREATED: "Creó respaldo",
  BACKUP_RESTORED: "Restauró respaldo",
  USER_REGISTERED: "Se registró",
  USER_UPDATED: "Actualizó perfil",
  PASSWORD_CHANGED: "Cambió contraseña",
  SETTINGS_CHANGED: "Cambió configuración",
  COLLABORATION_STARTED: "Inició colaboración",
  COLLABORATION_ENDED: "Finalizó colaboración",
  DOCUMENT_LOCKED: "Bloqueó documento",
  DOCUMENT_UNLOCKED: "Desbloqueó documento",
  CASE_CREATED: "Creó expediente",
  CASE_UPDATED: "Editó expediente",
  CASE_DOCUMENT_LINKED: "Vinculó documento a expediente",
  CASE_DOCUMENT_UNLINKED: "Desvinculó documento de expediente",
};

function getSpanishActivityName(activity: string): string {
  return ACTIVITY_LABELS[activity] || activity.replace(/_/g, " ").toLowerCase();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
  if (dDay.getTime() === today.getTime()) return { label: "Hoy", groupDate: formatGroupDate(today) };
  if (dDay.getTime() === yesterday.getTime()) return { label: "Ayer", groupDate: formatGroupDate(yesterday) };
  return { label: formatGroupDate(d), groupDate: "" };
}

function getActivityIcon(activity: string): { icon: string; iconBg: string; iconColor: string } {
  const t = activity.toLowerCase();
  if (t.includes("download") || t.includes("descarg")) return { icon: "download", iconBg: "bg-blue-50 dark:bg-blue-900/30", iconColor: "text-primary" };
  if (t.includes("upload") || t.includes("creat")) return { icon: "upload_file", iconBg: "bg-purple-50 dark:bg-purple-900/30", iconColor: "text-purple-600" };
  if (t.includes("update") || t.includes("edit") || t.includes("modif") || t.includes("cambio")) return { icon: "rule", iconBg: "bg-green-50 dark:bg-green-900/30", iconColor: "text-green-600" };
  if (t.includes("delete") || t.includes("elimin")) return { icon: "delete", iconBg: "bg-red-50 dark:bg-red-900/30", iconColor: "text-red-600" };
  if (t.includes("login") || t.includes("logout") || t.includes("auth") || t.includes("sesion")) return { icon: "login", iconBg: "bg-teal-50 dark:bg-teal-900/30", iconColor: "text-teal-600" };
  if (t.includes("share") || t.includes("compart") || t.includes("assign") || t.includes("asign")) return { icon: "share", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600" };
  if (t.includes("backup") || t.includes("respald")) return { icon: "backup", iconBg: "bg-emerald-50 dark:bg-emerald-900/30", iconColor: "text-emerald-600" };
  if (t.includes("password") || t.includes("contrase")) return { icon: "lock", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-600" };
  if (t.includes("group") || t.includes("member")) return { icon: "group_add", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600" };
  if (t.includes("permission") || t.includes("permiso")) return { icon: "admin_panel_settings", iconBg: "bg-amber-50 dark:bg-amber-900/30", iconColor: "text-amber-600" };
  if (t.includes("version")) return { icon: "history", iconBg: "bg-cyan-50 dark:bg-cyan-900/30", iconColor: "text-cyan-600" };
  if (t.includes("comment") || t.includes("coment")) return { icon: "comment", iconBg: "bg-pink-50 dark:bg-pink-900/30", iconColor: "text-pink-600" };
  if (t.includes("restore")) return { icon: "restore", iconBg: "bg-lime-50 dark:bg-lime-900/30", iconColor: "text-lime-600" };
  return { icon: "event", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-600" };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function toISO(dateStr: string, endOfDay = false): string {
  return endOfDay ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
}

function getDateRange(period: PeriodFilter, customFrom: string, customTo: string): { from?: string; to?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toYMD(today);
  if (period === "today") return { from: toISO(todayStr), to: toISO(todayStr, true) };
  if (period === "week") {
    const d = new Date(today); d.setDate(d.getDate() - 7);
    return { from: toISO(toYMD(d)), to: toISO(todayStr, true) };
  }
  if (period === "month") {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISO(toYMD(d)), to: toISO(todayStr, true) };
  }
  if (period === "custom" && customFrom && customTo) return { from: toISO(customFrom), to: toISO(customTo, true) };
  return {};
}

/** What category does a log entry belong to? */
function getCategoryForEntry(entry: ApiActivityLog): CategoryTab {
  const a = entry.activity;
  if (a.startsWith("DOCUMENT_ASSIGNED") || a.startsWith("DOCUMENT_SHARED") || a.startsWith("COLLABORATION_")) return "assignments";
  if (a.startsWith("DOCUMENT_")) return "documents";
  if (a.startsWith("CONVENIO_")) return "convenios";
  if (a.startsWith("GROUP_") || a === "USER_REGISTERED" || a === "USER_UPDATED") return "team";
  if (["LOGIN", "LOGOUT", "PASSWORD_CHANGED", "ADMIN_ACCESS_GRANTED", "ADMIN_ACCESS_DENIED", "BACKUP_CREATED", "BACKUP_RESTORED", "SETTINGS_CHANGED"].includes(a)) return "security";
  return "documents";
}

/** Get navigation path for an entity */
function getEntityLink(entry: ApiActivityLog): string | null {
  if (!entry.entityId) return null;
  const et = (entry.entityType || "").toLowerCase();
  if (et === "document") return `/documento/${entry.entityId}`;
  if (et === "convenio") return `/convenio/${entry.entityId}`;
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ActivityLog: React.FC = () => {
  const navigate = useNavigate();

  // Data
  const [logs, setLogs] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [period, setPeriod] = useState<PeriodFilter>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterUserName, setFilterUserName] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<"lawyer" | "action" | null>(null);
  const lawyerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  // Stats
  const [stats, setStats] = useState<{ todayCount: number; weekCount: number; byType: any[] } | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async (p: number, append = false) => {
    try {
      setLoading(true);
      const dateRange = getDateRange(period, customFrom, customTo);
      const result = await activityApi.list({
        page: p,
        limit: 20,
        userId: filterUserId || undefined,
        activity: filterAction || undefined,
        category: activeTab === "all" ? undefined : activeTab,
        ...dateRange,
      });
      const data = result.data ?? [];
      const resultTotal = (result as any).total ?? result.pagination?.total ?? data.length;
      const resultPage = (result as any).page ?? result.pagination?.page ?? p;
      const resultLimit = (result as any).limit ?? result.pagination?.limit ?? 20;
      setLogs(append ? prev => [...prev, ...data] : data);
      setTotal(resultTotal);
      setHasMore(resultPage * resultLimit < resultTotal);
    } catch (err) {
      console.error("Error cargando actividad:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, customFrom, customTo, filterUserId, filterAction]);

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  // Fetch stats once
  useEffect(() => {
    activityApi.stats().then(setStats).catch(() => { });
  }, []);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next, true);
  };

  const handleExport = async () => {
    try {
      const dateRange = getDateRange(period, customFrom, customTo);
      await activityApi.export({
        userId: filterUserId || undefined,
        activity: filterAction || undefined,
        category: activeTab === "all" ? undefined : activeTab,
        ...dateRange,
      });
    } catch (err) {
      console.error("Error exportando:", err);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (lawyerRef.current && !lawyerRef.current.contains(e.target as Node) &&
        actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Derived
  const uniqueUsers = logs.filter(l => l.user).reduce<{ id: string; name: string }[]>((acc, l) => {
    if (l.user && !acc.find(u => u.id === l.user!.id)) acc.push({ id: l.user!.id, name: l.user!.name });
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));
  const uniqueActions = Array.from(new Set(logs.map(l => l.activity))).sort();

  // Group by date
  const grouped = logs.reduce<{ key: string; label: string; entries: ApiActivityLog[] }[]>((acc, entry) => {
    const key = toYMD(new Date(entry.createdAt));
    const existing = acc.find(g => g.key === key);
    const { label, groupDate } = getGroupLabel(entry.createdAt);
    const fullLabel = groupDate ? `${label} — ${groupDate}` : label;
    if (existing) { existing.entries.push(entry); }
    else { acc.push({ key, label: fullLabel, entries: [entry] }); }
    return acc;
  }, []).sort((a, b) => (a.key > b.key ? -1 : 1));

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-1 w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 flex flex-col space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-2">
              <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
                <Link to="/" className="hover:text-primary">Inicio</Link>
                <span>/</span><span className="text-[#111318] dark:text-white">Bitácora</span>
              </nav>
              <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Bitácora de Actividad</h1>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-base">
                Historial centralizado de acciones en documentos, convenios, equipo, seguridad y asignaciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                <span className="truncate">Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* ── Category Tabs ── */}
          <div className="flex gap-2 flex-wrap border-b border-slate-200 dark:border-slate-700 pb-1">
            {CATEGORIES.map(cat => {
              const isActive = activeTab === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTab(cat.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-bold transition-all relative ${isActive
                    ? `${cat.colorClass} ${cat.badgeBg} border-b-2 border-current`
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Stats Cards ── */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-4 flex items-center gap-3 shadow-sm">
                <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-xl">today</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#111318] dark:text-white">{stats.todayCount}</p>
                  <p className="text-xs font-medium text-[#616f89] dark:text-[#64748b]">Acciones hoy</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-4 flex items-center gap-3 shadow-sm">
                <div className="size-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">date_range</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#111318] dark:text-white">{stats.weekCount}</p>
                  <p className="text-xs font-medium text-[#616f89] dark:text-[#64748b]">Esta semana</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-4 flex items-center gap-3 shadow-sm">
                <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 text-xl">leaderboard</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#111318] dark:text-white">{total}</p>
                  <p className="text-xs font-medium text-[#616f89] dark:text-[#64748b]">Total resultados</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Filters Panel ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User filter */}
                <div ref={lawyerRef} className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors" onClick={() => setOpenFilter(f => f === "lawyer" ? null : "lawyer")}>
                  <div className="text-primary">
                    <span className="material-symbols-outlined">person_search</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-[#616f89] dark:text-gray-400">Filtrar por</span>
                    <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">{filterUserName ?? "Usuario"}</h2>
                  </div>
                  <span className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openFilter === "lawyer" ? "rotate-180" : ""}`}>expand_more</span>
                  {openFilter === "lawyer" && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                      <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setFilterUserId(null); setFilterUserName(null); setOpenFilter(null); }}>Todos</button>
                      {uniqueUsers.map(u => (
                        <button key={u.id} type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setFilterUserId(u.id); setFilterUserName(u.name); setOpenFilter(null); }}>{u.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action filter */}
                <div ref={actionRef} className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors" onClick={() => setOpenFilter(f => f === "action" ? null : "action")}>
                  <div className="text-primary">
                    <span className="material-symbols-outlined">category</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-[#616f89] dark:text-gray-400">Filtrar por</span>
                    <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">{filterAction ? getSpanishActivityName(filterAction) : "Tipo de acción"}</h2>
                  </div>
                  <span className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openFilter === "action" ? "rotate-180" : ""}`}>expand_more</span>
                  {openFilter === "action" && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                      <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setFilterAction(null); setOpenFilter(null); }}>Todos</button>
                      {uniqueActions.map(a => (
                        <button key={a} type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); setFilterAction(a); setOpenFilter(null); }}>{getSpanishActivityName(a)}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Period filter */}
              <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-4">
                <span className="text-xs font-bold text-[#616f89] uppercase tracking-wider mr-2">Periodo:</span>
                {(["today", "week", "month", "custom"] as PeriodFilter[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === p
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                  >
                    <p className="text-sm font-medium leading-normal">
                      {p === "today" ? "Hoy" : p === "week" ? "Última semana" : p === "month" ? "Este mes" : "Personalizado"}
                    </p>
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

          {/* ── Timeline ── */}
          <div className="relative flex flex-col gap-8 pl-2">
            <div className="absolute left-[20px] top-0 bottom-0 w-0.5 bg-[#dbdfe6] dark:bg-gray-700" />

            {loading && logs.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
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
              <div className="py-16 text-center text-[#616f89] dark:text-gray-400 text-sm">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">search_off</span>
                </div>
                <p className="font-semibold text-base mb-1">No hay actividad</p>
                <p>No se encontraron registros que coincidan con los filtros seleccionados.</p>
              </div>
            ) : (
              grouped.map((group, gi) => (
                <div key={group.key} className="flex flex-col gap-4 relative">
                  {/* Date label */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`z-10 size-3 rounded-full ml-[14.5px] border-4 border-white dark:border-background-dark ${gi === 0 ? "bg-primary outline outline-1 outline-primary" : "bg-gray-400"}`} />
                    <h3 className="text-xs font-bold text-[#616f89] dark:text-gray-400 uppercase tracking-widest">{group.label}</h3>
                  </div>

                  {/* Entries */}
                  {group.entries.map(entry => {
                    const { icon, iconBg, iconColor } = getActivityIcon(entry.activity);
                    const cat = getCategoryForEntry(entry);
                    const catDef = CATEGORIES.find(c => c.key === cat)!;
                    const entityLink = getEntityLink(entry);

                    return (
                      <div key={entry.id} className="flex items-start gap-6 relative group">
                        <div className={`z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor} border-2 border-white dark:border-background-dark shadow-sm`}>
                          <span className="material-symbols-outlined text-xl">{icon}</span>
                        </div>
                        <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[#111318] dark:text-white font-medium text-sm">
                              <span className="font-bold">{entry.user?.name || "Sistema"}</span>
                              {" "}
                              {getSpanishActivityName(entry.activity)}
                              {entry.entityName && (
                                <>
                                  {" — "}
                                  {entityLink ? (
                                    <button
                                      onClick={() => navigate(entityLink)}
                                      className="italic text-primary cursor-pointer hover:underline bg-transparent border-none p-0 font-medium"
                                    >
                                      {entry.entityName}
                                    </button>
                                  ) : (
                                    <span className="italic text-[#616f89]">{entry.entityName}</span>
                                  )}
                                </>
                              )}
                            </p>
                            <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap ml-3">
                              {formatTime(entry.createdAt)}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-[#616f89] dark:text-[#64748b] mt-1 line-clamp-2">{entry.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Category badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${catDef.badgeBg} ${catDef.colorClass}`}>
                              <span className="material-symbols-outlined text-[12px]">{catDef.icon}</span>
                              {catDef.label}
                            </span>
                            {/* Activity type badge */}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-primary">
                              {getSpanishActivityName(entry.activity)}
                            </span>
                            {/* Entity type badge */}
                            {entry.entityType && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-gray-400">
                                {entry.entityType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* ── Load More / Loading ── */}
          <div className="flex justify-center py-10">
            {hasMore && !loading && (
              <button onClick={handleLoadMore} className="flex items-center gap-2 text-primary font-bold text-sm hover:bg-primary/5 px-6 py-2 rounded-full transition-colors border border-primary/20">
                <span className="material-symbols-outlined">history</span>
                Cargar actividad anterior
              </button>
            )}
            {loading && logs.length > 0 && (
              <div className="flex items-center gap-2 text-[#616f89]">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Cargando...
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
};