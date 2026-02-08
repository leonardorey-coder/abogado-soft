import React, { useState, useRef, useEffect } from "react";
import { ViewState } from "../types";

type PeriodFilter = "today" | "week" | "month" | "custom";

interface ActivityEntry {
  id: string;
  lawyer: string;
  actionType: string;
  date: string;
  time: string;
  groupLabel: string;
  groupDate: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  content: React.ReactNode;
  extraContent?: React.ReactNode;
  tags: string[];
}

interface ActivityLogProps {
  onNavigate: (view: ViewState) => void;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatGroupDate(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getActivities(): ActivityEntry[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = toYMD(today);
  const yesterdayStr = toYMD(yesterday);
  return [
  {
    id: "1",
    lawyer: "Carlos Mendoza",
    actionType: "DESCARGA",
    date: todayStr,
    time: "14:20 PM",
    groupLabel: "Hoy",
    groupDate: formatGroupDate(today),
    icon: "download",
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-primary",
    content: (
      <>
        <span className="font-bold">Carlos Mendoza</span> descargó el archivo{" "}
        <span className="italic text-primary cursor-pointer hover:underline">
          Contrato_Arrendamiento_V2.pdf
        </span>
      </>
    ),
    tags: ["DESCARGA", "LEGAL"],
  },
  {
    id: "2",
    lawyer: "María Valdés",
    actionType: "CAMBIO_ESTADO",
    date: todayStr,
    time: "11:05 AM",
    groupLabel: "Hoy",
    groupDate: formatGroupDate(today),
    icon: "rule",
    iconBg: "bg-green-50 dark:bg-green-900/30",
    iconColor: "text-green-600",
    content: (
      <>
        <span className="font-bold">María Valdés</span> cambió el estado del
        documento a{" "}
        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
          Revisado
        </span>
      </>
    ),
    extraContent: (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        &quot;Se han verificado todos los anexos solicitados por el juez.&quot;
      </p>
    ),
    tags: [],
  },
  {
    id: "3",
    lawyer: "Jorge Ramírez",
    actionType: "SUBIDA",
    date: yesterdayStr,
    time: "16:45 PM",
    groupLabel: "Ayer",
    groupDate: formatGroupDate(yesterday),
    icon: "upload_file",
    iconBg: "bg-purple-50 dark:bg-purple-900/30",
    iconColor: "text-purple-600",
    content: (
      <>
        <span className="font-bold">Jorge Ramírez</span> subió una nueva versión
        de{" "}
        <span className="font-semibold text-primary underline decoration-primary/30 cursor-pointer">
          Escrito_Demanda_Final.docx
        </span>
      </>
    ),
    extraContent: (
      <div className="mt-3 flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
        <span className="material-symbols-outlined text-gray-400">
          description
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-bold dark:text-gray-300">
            v3.0 - Última versión
          </span>
          <span className="text-[10px] text-gray-500 uppercase">
            2.4 MB • Word Document
          </span>
        </div>
      </div>
    ),
    tags: [],
  },
  {
    id: "4",
    lawyer: "Sistema",
    actionType: "EVENTO",
    date: yesterdayStr,
    time: "09:30 AM",
    groupLabel: "Ayer",
    groupDate: formatGroupDate(yesterday),
    icon: "event",
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
    iconColor: "text-orange-600",
    content: (
      <>
        <span className="font-bold">Sistema</span> agendó una nueva{" "}
        <span className="font-bold text-orange-600">
          Audiencia de Conciliación
        </span>
      </>
    ),
    extraContent: (
      <div className="flex items-center gap-4 mt-2 py-1 px-3 bg-orange-50/50 dark:bg-orange-900/10 rounded border border-orange-100 dark:border-orange-900/30">
        <span className="material-symbols-outlined text-orange-500 text-sm">
          calendar_month
        </span>
        <span className="text-xs font-medium text-orange-800 dark:text-orange-300">
          Programada para: 05 de Noviembre, 2023 - 10:00 AM
        </span>
      </div>
    ),
    tags: [],
  },
  ];
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isInPeriod(
  dateStr: string,
  period: PeriodFilter,
  customFrom?: string,
  customTo?: string
): boolean {
  const d = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "today") {
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }
  if (period === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && d <= today;
  }
  if (period === "month") {
    return (
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
    );
  }
  if (period === "custom" && customFrom && customTo) {
    const from = parseDate(customFrom);
    const to = parseDate(customTo);
    return d >= from && d <= to;
  }
  return true;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ onNavigate }) => {
  const [lawyerFilter, setLawyerFilter] = useState<string | null>(null);
  const [actionTypeFilter, setActionTypeFilter] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [openDropdown, setOpenDropdown] = useState<"lawyer" | "action" | null>(
    null
  );
  const lawyerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const activities = getActivities();
  const lawyers = Array.from(
    new Set(activities.map((a) => a.lawyer))
  ).sort();
  const actionTypes = Array.from(
    new Set(activities.map((a) => a.actionType))
  ).sort();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        lawyerRef.current?.contains(e.target as Node) ||
        actionRef.current?.contains(e.target as Node)
      )
        return;
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = activities.filter((a) => {
    if (lawyerFilter && a.lawyer !== lawyerFilter) return false;
    if (actionTypeFilter && a.actionType !== actionTypeFilter) return false;
    if (!isInPeriod(a.date, period, customFrom, customTo)) return false;
    return true;
  });

  const grouped = filtered
    .reduce<{ key: string; label: string; entries: ActivityEntry[] }[]>(
      (acc, entry) => {
        const key = entry.date;
        const existing = acc.find((g) => g.key === key);
        const label =
          entry.groupLabel === "Hoy"
            ? `Hoy - ${entry.groupDate}`
            : `${entry.groupLabel} - ${entry.groupDate}`;
        if (existing) {
          existing.entries.push(entry);
        } else {
          acc.push({ key, label, entries: [entry] });
        }
        return acc;
      },
      []
    )
    .sort((a, b) => (a.key > b.key ? -1 : 1));

  return (
    <div className="relative flex flex-1 w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 flex flex-col space-y-8">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-2">
              <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
                <button
                  type="button"
                  className="hover:text-primary cursor-pointer"
                  onClick={() => onNavigate(ViewState.DASHBOARD)}
                >
                  Inicio
                </button>
                <span>/</span>
                <span className="text-[#111318] dark:text-white">Bitácora</span>
              </nav>
              <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">
                Bitácora de Actividad
              </h1>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
                Historial de acciones en documentos y convenios del despacho.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-white dark:bg-gray-800 text-[#111318] dark:text-white text-sm font-bold border border-[#dbdfe6] dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span className="material-symbols-outlined text-lg">share</span>
                <span className="truncate">Compartir</span>
              </button>
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors">
                <span className="material-symbols-outlined text-lg">download</span>
                <span className="truncate">Exportar Reporte</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col flex-1 w-full">
            {/* Filter Section (TextGrid + Chips) */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-[#dbdfe6] dark:border-gray-800 mb-8 p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    ref={lawyerRef}
                    className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() =>
                      setOpenDropdown((v) => (v === "lawyer" ? null : "lawyer"))
                    }
                  >
                    <div className="text-primary" data-icon="User">
                      <span className="material-symbols-outlined">
                        person_search
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">
                        Filtrar por
                      </span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">
                        {lawyerFilter ?? "Abogado responsable"}
                      </h2>
                    </div>
                    <span
                      className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openDropdown === "lawyer" ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                    {openDropdown === "lawyer" && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLawyerFilter(null);
                            setOpenDropdown(null);
                          }}
                        >
                          Todos
                        </button>
                        {lawyers.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLawyerFilter(name);
                              setOpenDropdown(null);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    ref={actionRef}
                    className="relative flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() =>
                      setOpenDropdown((v) => (v === "action" ? null : "action"))
                    }
                  >
                    <div className="text-primary" data-icon="Files">
                      <span className="material-symbols-outlined">
                        category
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">
                        Filtrar por
                      </span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight truncate">
                        {actionTypeFilter ?? "Tipo de acción"}
                      </h2>
                    </div>
                    <span
                      className={`material-symbols-outlined ml-auto text-gray-400 transition-transform ${openDropdown === "action" ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                    {openDropdown === "action" && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionTypeFilter(null);
                            setOpenDropdown(null);
                          }}
                        >
                          Todos
                        </button>
                        {actionTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionTypeFilter(type);
                              setOpenDropdown(null);
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-4">
                  <span className="text-xs font-bold text-[#616f89] uppercase tracking-wider mr-2">
                    Periodo:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeriod("today")}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === "today" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                  >
                    <p className="text-sm font-semibold leading-normal">Hoy</p>
                    {period === "today" && (
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("week")}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === "week" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                  >
                    <p className="text-sm font-medium leading-normal">
                      Última semana
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("month")}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === "month" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                  >
                    <p className="text-sm font-medium leading-normal">
                      Este mes
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("custom")}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-colors ${period === "custom" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                  >
                    <p className="text-sm font-medium leading-normal">
                      Personalizado
                    </p>
                    <span className="material-symbols-outlined text-sm">
                      calendar_today
                    </span>
                  </button>
                  {period === "custom" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                      />
                      <span className="text-[#616f89]">a</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Activity Timeline */}
            <div className="relative flex flex-col gap-8 pl-2">
              <div className="absolute left-[20px] top-0 bottom-0 w-0.5 bg-[#dbdfe6] dark:bg-gray-700"></div>
              {grouped.length === 0 ? (
                <div className="py-12 text-center text-[#616f89] dark:text-gray-400 text-sm">
                  No hay actividad que coincida con los filtros.
                </div>
              ) : (
                grouped.map((group, groupIdx) => (
                  <div
                    key={group.key}
                    className="flex flex-col gap-4 relative"
                  >
                    <div className="flex items-center gap-4 mb-2">
                      <div
                        className={`z-10 size-3 rounded-full ml-[14.5px] border-4 border-white dark:border-background-dark ${groupIdx === 0 ? "bg-primary outline outline-1 outline-primary" : "bg-gray-400"}`}
                      ></div>
                      <h3 className="text-xs font-bold text-[#616f89] dark:text-gray-400 uppercase tracking-widest">
                        {group.label}
                      </h3>
                    </div>
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-6 relative group"
                      >
                        <div
                          className={`z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${entry.iconBg} ${entry.iconColor} border-2 border-white dark:border-background-dark shadow-sm`}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {entry.icon}
                          </span>
                        </div>
                        <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[#111318] dark:text-white font-medium">
                              {entry.content}
                            </p>
                            <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">
                              {entry.time}
                            </span>
                          </div>
                          {entry.extraContent}
                          {entry.tags.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    tag === "LEGAL"
                                      ? "bg-blue-50 dark:bg-blue-900/20 text-primary"
                                      : "bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-gray-400"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            {/* Pagination / Load More */}
            <div className="flex justify-center py-10">
              <button className="flex items-center gap-2 text-primary font-bold text-sm hover:bg-primary/5 px-6 py-2 rounded-full transition-colors border border-primary/20">
                <span className="material-symbols-outlined">history</span>
                Cargar actividad anterior
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};