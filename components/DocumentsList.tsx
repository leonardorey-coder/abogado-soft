import React, { useState, useEffect, useRef, useCallback } from "react";
import { ViewState, Document, FileStatus } from "../types";
import { documentsApi } from "../lib/api";
import { apiDocToFrontend } from "../lib/useDocuments";

interface DocumentsListProps {
  onNavigate: (view: ViewState) => void;
  searchQuery?: string;
  onOpenDocument?: (docId: string, docType?: string) => void;
}

const getFileStatusBadge = (status: FileStatus) => {
  switch (status) {
    case "ACTIVO": return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
    case "PENDIENTE": return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "INACTIVO": return "bg-[#e2e6eb] dark:bg-[#2d3748] text-[#616f89] dark:text-[#a0aec0] border-[#dbdfe6] dark:border-[#2d3748]";
    default: return "bg-gray-100 text-gray-600";
  }
};

const getFileStatusOptionClass = (status: FileStatus, isSelected: boolean) => {
  const base = "w-full text-left px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors ";
  const hover = "hover:opacity-90 ";
  switch (status) {
    case "ACTIVO": return base + hover + (isSelected ? "text-green-800 dark:text-green-300 bg-green-50 dark:bg-green-900/20" : "text-green-700 dark:text-green-400");
    case "PENDIENTE": return base + hover + (isSelected ? "text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20" : "text-yellow-700 dark:text-yellow-400");
    case "INACTIVO": return base + hover + (isSelected ? "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-900/20" : "text-red-700 dark:text-red-400");
    default: return base + hover + "text-[#111318] dark:text-white";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) { case "DOCX": return "description"; case "PDF": return "picture_as_pdf"; case "XLSX": return "table_view"; default: return "article"; }
};

const FILE_STATUS_OPTIONS: { value: FileStatus; label: string }[] = [
  { value: "ACTIVO", label: "Activo" }, { value: "PENDIENTE", label: "Pendiente" }, { value: "INACTIVO", label: "Inactivo" }
];

export const DocumentsList: React.FC<DocumentsListProps> = ({ onNavigate, searchQuery = "", onOpenDocument }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"TODOS" | FileStatus>("TODOS");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ todos: 0, activos: 0, pendientes: 0, inactivos: 0 });
  const [statusDropdownDocId, setStatusDropdownDocId] = useState<string | null>(null);
  const [lastClickedRowId, setLastClickedRowId] = useState<string | null>(null);
  const [lastClickAt, setLastClickAt] = useState(0);
  const perPage = 10;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await documentsApi.list({ page, limit: perPage, search: searchQuery || undefined, fileStatus: filter !== "TODOS" ? filter : undefined });
      setDocuments(res.data.map(apiDocToFrontend));
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) { console.error('Error cargando documentos:', err); } finally { setLoading(false); }
  }, [page, searchQuery, filter]);

  const fetchCounts = useCallback(async () => {
    try {
      const [all, a, p, i] = await Promise.all([
        documentsApi.list({ limit: 1 }), documentsApi.list({ limit: 1, fileStatus: 'ACTIVO' }),
        documentsApi.list({ limit: 1, fileStatus: 'PENDIENTE' }), documentsApi.list({ limit: 1, fileStatus: 'INACTIVO' }),
      ]);
      setCounts({ todos: all.pagination.total, activos: a.pagination.total, pendientes: p.pagination.total, inactivos: i.pagination.total });
    } catch (err) { console.error('Error cargando conteos:', err); }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { setPage(1); }, [searchQuery, filter]);

  const handleVer = (doc: Document) => {
    if (onOpenDocument) { onOpenDocument(doc.id, doc.type); }
    else { doc.type === "XLSX" ? onNavigate(ViewState.EXCEL_EDITOR) : onNavigate(ViewState.EDITOR); }
  };

  const handleEliminar = async (doc: Document) => {
    if (!confirm(`¿Enviar "${doc.name}" a la papelera?`)) return;
    try {
      await documentsApi.delete(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setTotal(prev => prev - 1);
      fetchCounts();
    } catch (err) { console.error('Error eliminando documento:', err); }
  };

  const handleStatusChange = async (docId: string, newStatus: FileStatus) => {
    try { await documentsApi.update(docId, { fileStatus: newStatus }); setDocuments(prev => prev.map(d => d.id === docId ? { ...d, fileStatus: newStatus } : d)); setStatusDropdownDocId(null); fetchCounts(); }
    catch (err) { console.error('Error actualizando estado:', err); }
  };

  const handleRowClick = (e: React.MouseEvent, doc: Document) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const now = Date.now();
    if (lastClickedRowId === doc.id && now - lastClickAt <= 1500) { handleVer(doc); setLastClickedRowId(null); }
    else { setLastClickedRowId(doc.id); setLastClickAt(now); }
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statusDropdownDocId) return;
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setStatusDropdownDocId(null); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [statusDropdownDocId]);

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
            <button type="button" className="hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>Inicio</button>
            <span>/</span><span className="text-[#111318] dark:text-white">Documentos</span>
          </nav>
          <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Gestión de Documentos</h1>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Administre y visualice los documentos del despacho con total claridad.</p>
        </div>
        <button type="button" onClick={() => onNavigate(ViewState.EDITOR)} className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors">
          <span className="material-symbols-outlined">add_circle</span> Nuevo Documento
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="text-[#111318] dark:text-white font-bold text-sm px-1">Filtrar por Estado</label>
            <div className="relative">
              <select value={filter} onChange={(e) => { setFilter(e.target.value as "TODOS" | FileStatus); setPage(1); }} className="appearance-none w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 cursor-pointer pr-10">
                <option value="TODOS">Todos los estados</option><option value="ACTIVO">Activo</option><option value="PENDIENTE">Pendiente</option><option value="INACTIVO">Inactivo</option>
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
          { key: "TODOS" as const, label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
          { key: "ACTIVO" as const, label: "Activos", count: counts.activos, icon: "verified", color: "text-green-600" },
          { key: "PENDIENTE" as const, label: "Pendientes", count: counts.pendientes, icon: "pending", color: "text-orange-600" },
          { key: "INACTIVO" as const, label: "Inactivos", count: counts.inactivos, icon: "error", color: "text-red-600" },
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
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">Nombre</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%]">Tipo</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[23%]">Última modificación</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">Estado</th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" /></td>
                <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-12" /></td>
                <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24" /></td>
                <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto" /></td>
                <td className="px-6 py-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" /></td>
              </tr>
            )) : documents.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-[#616f89] dark:text-[#a0aec0]">
                <span className="material-symbols-outlined text-4xl block mb-2">folder_off</span>No se encontraron documentos
              </td></tr>
            ) : documents.map((doc) => (
              <tr key={doc.id} onClick={(e) => handleRowClick(e, doc)} className={`transition-colors cursor-pointer ${lastClickedRowId === doc.id ? "bg-[#e2e6eb] dark:bg-[#2d3748]" : "hover:bg-background-light dark:hover:bg-[#101622]/50"}`}>
                <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-[#616f89] dark:text-[#a0aec0]">{getTypeIcon(doc.type)}</span><span className="text-[#111318] dark:text-white font-bold text-base truncate max-w-[240px]">{doc.name}</span></div></td>
                <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] font-medium text-sm">{doc.type}</td>
                <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] text-sm">{doc.lastModified}</td>
                <td className="px-6 py-4 text-center">
                  <div ref={statusDropdownDocId === doc.id ? dropdownRef : undefined} className="relative inline-block">
                    <button type="button" onClick={() => setStatusDropdownDocId(id => id === doc.id ? null : doc.id)} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase cursor-pointer transition-opacity hover:opacity-90 ${getFileStatusBadge(doc.fileStatus)}`}>
                      {doc.fileStatus}<span className="material-symbols-outlined text-sm">expand_more</span>
                    </button>
                    {statusDropdownDocId === doc.id && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-lg overflow-hidden">
                        {FILE_STATUS_OPTIONS.map(opt => (<button key={opt.value} type="button" onClick={() => handleStatusChange(doc.id, opt.value)} className={getFileStatusOptionClass(opt.value, doc.fileStatus === opt.value)}>{opt.label}</button>))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => handleVer(doc)} className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-lg">visibility</span>Ver
                    </button>
                    <button type="button" onClick={() => handleEliminar(doc)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center" title="Enviar a papelera">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-4 bg-background-light dark:bg-[#101622] flex items-center justify-between border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:border-primary disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>Anterior
          </button>
          <span className="text-sm font-bold text-[#111318] dark:text-white">Página <span className="text-primary">{page}</span> de {totalPages}</span>
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl text-sm font-bold text-primary hover:border-primary disabled:opacity-50 transition-colors">
            Siguiente<span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4 text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">
        <p>Mostrando {documents.length} de {total} documentos{filter !== "TODOS" ? " (filtrado)" : ""}.</p>
        <button type="button" className="flex items-center gap-2 hover:text-primary font-bold transition-colors">
          <span className="material-symbols-outlined text-lg">download</span>Exportar lista a PDF/Excel
        </button>
      </div>
    </main>
  );
};
