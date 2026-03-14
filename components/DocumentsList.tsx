import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, FileStatus } from "../types";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { documentsApi } from "../lib/api";
import { apiDocToFrontend } from "../lib/useDocuments";
import { useFileDragDrop } from "../lib/useFileDragDrop";
import { Upload } from "lucide-react";

interface DocumentsListProps {
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
  const base = "w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors ";
  switch (status) {
    case "ACTIVO": return base + (isSelected ? "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-green-600 dark:hover:text-green-400");
    case "PENDIENTE": return base + (isSelected ? "text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-yellow-600 dark:hover:text-yellow-400");
    case "INACTIVO": return base + (isSelected ? "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200");
    default: return base + "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) { case "DOCX": return "description"; case "PDF": return "picture_as_pdf"; case "XLSX": return "table_view"; default: return "article"; }
};

const FILE_STATUS_OPTIONS: { value: FileStatus; label: string }[] = [
  { value: "ACTIVO", label: "Activo" }, { value: "PENDIENTE", label: "Pendiente" }, { value: "INACTIVO", label: "Inactivo" }
];

export const DocumentsList: React.FC<DocumentsListProps> = ({ searchQuery = "", onOpenDocument }) => {
  const navigate = useNavigate();
  const { openUploadModal } = useOutletContext<{ openUploadModal: (files?: File[]) => void }>();
  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => openUploadModal(files),
  });
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
    else { navigate(`/documento/${doc.id}`); }
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
    <>
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
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
            <Link to="/" className="hover:text-primary">Inicio</Link>
            <span>/</span><span className="text-[#111318] dark:text-white">Documentos</span>
          </nav>
          <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">Gestión de Documentos</h1>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Administre y visualice los documentos del despacho con total claridad.</p>
        </div>
        <button type="button" onClick={() => openUploadModal()} className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors">
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

      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
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

      <div className="rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm flex flex-col">
        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-background-light dark:bg-[#101622] border-b border-[#dbdfe6] dark:border-[#2d3748]">
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">Nombre</th>
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%]">Tipo</th>
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[23%]">Última modificación</th>
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">Estado</th>
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[8%] text-center">Sync</th>
                <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-12" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-8 mx-auto" /></td>
                  <td className="px-6 py-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" /></td>
                </tr>
              )) : documents.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[#616f89] dark:text-[#a0aec0]">
                  <span className="material-symbols-outlined text-4xl block mb-2">folder_off</span>No se encontraron documentos
                </td></tr>
              ) : documents.map((doc) => (
                <tr key={doc.id} onClick={(e) => handleRowClick(e, doc)} className={`transition-colors cursor-pointer ${lastClickedRowId === doc.id ? "bg-[#e2e6eb] dark:bg-[#2d3748]" : "hover:bg-background-light dark:hover:bg-[#101622]/50"}`}>
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-[#616f89] dark:text-[#a0aec0]">{getTypeIcon(doc.type)}</span><span className="text-[#111318] dark:text-white font-bold text-base truncate max-w-[240px]">{doc.name}</span></div></td>
                  <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] font-medium text-sm">{doc.type}</td>
                  <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] text-sm">{doc.lastModified}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${getFileStatusBadge(doc.fileStatus)}`}>
                      {doc.fileStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(doc as any).syncStatus === 'completed' ? (
                      <span className="material-symbols-outlined text-green-500 text-lg" title="Sincronizado con Drive">cloud_done</span>
                    ) : (doc as any).syncStatus === 'syncing' ? (
                      <span className="material-symbols-outlined text-amber-500 text-lg animate-pulse" title="Sincronizando…">cloud_sync</span>
                    ) : (doc as any).syncStatus === 'failed' ? (
                      <span className="material-symbols-outlined text-red-500 text-lg" title="Error de sincronización">cloud_off</span>
                    ) : (
                      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-lg" title="Sin sincronizar">cloud_upload</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div ref={statusDropdownDocId === doc.id ? dropdownRef : undefined} className="relative inline-block text-left">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setStatusDropdownDocId(id => id === doc.id ? null : doc.id); }} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                      {statusDropdownDocId === doc.id && (
                        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden py-1 transform-gpu">
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleVer(doc); setStatusDropdownDocId(null); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <span className="material-symbols-outlined text-[20px] text-primary">visibility</span>Abrir Documento
                          </button>
                          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 w-full" />
                          <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Cambiar Estado</div>
                          {FILE_STATUS_OPTIONS.map(opt => (
                            <button key={opt.value} type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange(doc.id, opt.value); }} className={getFileStatusOptionClass(opt.value, doc.fileStatus === opt.value)}>
                              <span className="material-symbols-outlined text-[18px]">{doc.fileStatus === opt.value ? "radio_button_checked" : "radio_button_unchecked"}</span>{opt.label}
                            </button>
                          ))}
                          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 w-full" />
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleEliminar(doc); setStatusDropdownDocId(null); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">delete</span>Enviar a papelera
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden flex flex-col divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse flex flex-col gap-3">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full mt-2" />
            </div>
          )) : documents.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#616f89] dark:text-[#a0aec0]">
              <span className="material-symbols-outlined text-4xl block mb-2">folder_off</span>No se encontraron documentos
            </div>
          ) : documents.map((doc) => (
            <div key={doc.id} onClick={(e) => handleRowClick(e, doc)} className={`p-4 flex flex-col gap-3 transition-colors cursor-pointer ${lastClickedRowId === doc.id ? "bg-[#e2e6eb] dark:bg-[#2d3748]" : "hover:bg-background-light dark:hover:bg-[#101622]/50"}`}>
              <div className="flex items-start gap-3 mb-1">
                <span className="material-symbols-outlined text-[#616f89] dark:text-[#a0aec0] text-3xl shrink-0">{getTypeIcon(doc.type)}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider block mb-0.5">Nombre</span>
                  <h4 className="text-[#111318] dark:text-white font-bold text-base line-clamp-2 leading-tight">{doc.name}</h4>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 bg-[#f6f6f8] dark:bg-[#101622] p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider">Tipo</span>
                  <span className="text-sm font-semibold text-[#111318] dark:text-white">{doc.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider">Última modificación</span>
                  <span className="text-sm font-medium text-[#111318] dark:text-white">{doc.lastModified}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider">Estado</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${getFileStatusBadge(doc.fileStatus)}`}>
                    {doc.fileStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider">Sync</span>
                  {(doc as any).syncStatus === 'completed' ? (
                    <span className="material-symbols-outlined text-green-500 text-base" title="Sincronizado con Drive">cloud_done</span>
                  ) : (doc as any).syncStatus === 'syncing' ? (
                    <span className="material-symbols-outlined text-amber-500 text-base animate-pulse" title="Sincronizando…">cloud_sync</span>
                  ) : (doc as any).syncStatus === 'failed' ? (
                    <span className="material-symbols-outlined text-red-500 text-base" title="Error de sincronización">cloud_off</span>
                  ) : (
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-base" title="Sin sincronizar">cloud_upload</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-1" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleVer(doc); }} className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>Ver
                </button>
                <div ref={statusDropdownDocId === doc.id ? dropdownRef : undefined} className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setStatusDropdownDocId(id => id === doc.id ? null : doc.id); }} className="p-2 bg-[#f6f6f8] dark:bg-[#101622] rounded-lg text-[#616f89] dark:text-[#a0aec0] hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                  {statusDropdownDocId === doc.id && (
                    <div className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden py-1 transform-gpu">
                      <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Cambiar Estado</div>
                      {FILE_STATUS_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange(doc.id, opt.value); }} className={getFileStatusOptionClass(opt.value, doc.fileStatus === opt.value)}>
                          <span className="material-symbols-outlined text-[18px]">{doc.fileStatus === opt.value ? "radio_button_checked" : "radio_button_unchecked"}</span>{opt.label}
                        </button>
                      ))}
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 w-full" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleEliminar(doc); setStatusDropdownDocId(null); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">delete</span>Enviar a papelera
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 sm:px-6 py-4 bg-background-light dark:bg-[#101622] flex items-center justify-between border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:border-primary disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined text-base sm:text-xl">arrow_back</span><span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="text-xs sm:text-sm font-bold text-[#111318] dark:text-white">Página <span className="text-primary">{page}</span> de {totalPages}</span>
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-primary hover:border-primary disabled:opacity-50 transition-colors">
            <span className="hidden sm:inline">Siguiente</span><span className="material-symbols-outlined text-base sm:text-xl">arrow_forward</span>
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
    </>
  );
};
