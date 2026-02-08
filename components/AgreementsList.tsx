import React, { useState, useEffect, useCallback } from "react";
import { ViewState } from "../types";
import { conveniosApi, ApiConvenio } from "../lib/api";

interface AgreementsListProps {
  onNavigate: (view: ViewState) => void;
}

type EstadoConvenio = "ACTIVO" | "PENDIENTE" | "EXPIRADO";
type FilterEstado = "TODOS" | EstadoConvenio;

const PER_PAGE = 9;

const estadoStyles: Record<EstadoConvenio, string> = {
  ACTIVO: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
  PENDIENTE: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  EXPIRADO: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
};

const estadoDot: Record<EstadoConvenio, string> = {
  ACTIVO: "bg-green-600",
  PENDIENTE: "bg-orange-600",
  EXPIRADO: "bg-red-600",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export const AgreementsList: React.FC<AgreementsListProps> = ({ onNavigate }) => {
  const [convenios, setConvenios] = useState<ApiConvenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterEstado>("TODOS");
  const [counts, setCounts] = useState({ todos: 0, activos: 0, pendientes: 0, expirados: 0 });

  const fetchConvenios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await conveniosApi.list({ page, limit: PER_PAGE, estado: filter !== "TODOS" ? filter : undefined });
      setConvenios(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) { console.error("Error cargando convenios:", err); } finally { setLoading(false); }
  }, [page, filter]);

  const fetchCounts = useCallback(async () => {
    try {
      const [all, a, p, e] = await Promise.all([
        conveniosApi.list({ limit: 1 }), conveniosApi.list({ limit: 1, estado: "ACTIVO" }),
        conveniosApi.list({ limit: 1, estado: "PENDIENTE" }), conveniosApi.list({ limit: 1, estado: "EXPIRADO" }),
      ]);
      setCounts({ todos: all.pagination.total, activos: a.pagination.total, pendientes: p.pagination.total, expirados: e.pagination.total });
    } catch (err) { console.error("Error cargando conteos:", err); }
  }, []);

  useEffect(() => { fetchConvenios(); }, [fetchConvenios]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { setPage(1); }, [filter]);

  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
            <button type="button" className="hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>Inicio</button>
            <span>/</span><span className="text-[#111318] dark:text-white">Convenios</span>
          </nav>
          <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Gestión de Convenios</h1>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Administre y visualice los acuerdos legales de la universidad con total claridad.</p>
        </div>
        <button type="button" className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors">
          <span className="material-symbols-outlined">add_circle</span>Nuevo Convenio
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="text-[#111318] dark:text-white font-bold text-sm px-1">Filtrar por Estado</label>
            <div className="relative">
              <select value={filter} onChange={(e) => setFilter(e.target.value as FilterEstado)} className="appearance-none w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 cursor-pointer pr-10">
                <option value="TODOS">Todos los estados</option><option value="ACTIVO">Activo</option><option value="PENDIENTE">Pendiente</option><option value="EXPIRADO">Expirado</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#616f89]">expand_more</span>
            </div>
          </div>
          <div className="flex items-end gap-3 mt-auto h-[72px] pb-1">
            <button type="button" onClick={() => setFilter("TODOS")} className="bg-[#e2e6eb] dark:bg-[#2d3748] hover:bg-[#dbdfe6] dark:hover:bg-[#374151] text-[#111318] dark:text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors">Limpiar Filtros</button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        {([
          { key: "TODOS" as FilterEstado, label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
          { key: "ACTIVO" as FilterEstado, label: "Activos", count: counts.activos, icon: "verified", color: "text-green-600" },
          { key: "PENDIENTE" as FilterEstado, label: "Pendientes", count: counts.pendientes, icon: "pending", color: "text-orange-600" },
          { key: "EXPIRADO" as FilterEstado, label: "Expirados", count: counts.expirados, icon: "error", color: "text-red-600" },
        ]).map(pill => (
          <button key={pill.key} type="button" onClick={() => setFilter(pill.key)} className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all ${filter === pill.key ? "bg-primary text-white" : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}`}>
            <span className={`material-symbols-outlined text-xl ${filter === pill.key ? "" : pill.color}`}>{pill.icon}</span>
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-light dark:bg-[#101622] border-b border-[#dbdfe6] dark:border-[#2d3748]">
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[20%]">Nº de Convenio</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">Institución Colaboradora</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">Fecha Firma</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">Estado</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-6 py-5"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24" /></td>
                <td className="px-6 py-5"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48" /></td>
                <td className="px-6 py-5"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20 mx-auto" /></td>
                <td className="px-6 py-5"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto" /></td>
                <td className="px-6 py-5"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" /></td>
              </tr>
            )) : convenios.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-[#616f89] dark:text-[#a0aec0]">
                <span className="material-symbols-outlined text-4xl block mb-2">folder_off</span>No se encontraron convenios
              </td></tr>
            ) : convenios.map((c) => {
              const estado = (c.estado as EstadoConvenio) || "PENDIENTE";
              return (
                <tr key={c.id} className="hover:bg-[#f6f6f8] dark:hover:bg-[#101622]/50 transition-colors">
                  <td className="px-6 py-5 text-[#111318] dark:text-white font-bold">{c.numero}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-[#111318] dark:text-white font-bold">{c.institucion}</span>
                      <span className="text-[#616f89] dark:text-[#a0aec0] text-sm">{c.departamento || c.descripcion || ""}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[#616f89] dark:text-[#a0aec0] font-medium text-center">{formatFecha(c.fechaInicio)}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold uppercase ${estadoStyles[estado] || estadoStyles.PENDIENTE}`}>
                      <span className={`size-2 rounded-full ${estadoDot[estado] || estadoDot.PENDIENTE}`} /> {estado === "ACTIVO" ? "Activo" : estado === "PENDIENTE" ? "Pendiente" : "Expirado"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button type="button" onClick={() => onNavigate(ViewState.EDITOR)} className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 ml-auto">
                      <span className="material-symbols-outlined text-lg">visibility</span>Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-6 py-5 bg-background-light dark:bg-[#101622] flex items-center justify-between border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl font-bold text-sm text-[#616f89] dark:text-[#a0aec0] hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined">arrow_back</span>Anterior
          </button>
          <div className="text-sm font-bold text-[#111318] dark:text-white">Página <span className="text-primary">{page}</span> de {totalPages}</div>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl font-bold text-sm text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Siguiente<span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4 text-[#616f89] dark:text-[#a0aec0] text-sm p-2">
        <p>Mostrando {total > 0 ? `${from}-${to}` : 0} de {total} convenios totales registrados en el sistema.</p>
        <button type="button" className="flex items-center gap-2 hover:text-primary font-bold transition-colors">
          <span className="material-symbols-outlined">download</span>Exportar lista a PDF/Excel
        </button>
      </div>
    </main>
  );
};