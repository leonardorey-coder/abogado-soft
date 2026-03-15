import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { documentsApi, ApiDocument } from "../lib/api";
import { getDocumentRoute } from "../lib/routes";

const getFileIcon = (type: string) => {
  switch (type?.toUpperCase()) {
    case "DOCX": case "DOC":
      return { icon: "description", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    case "PDF":
      return { icon: "picture_as_pdf", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    case "XLSX": case "XLS":
      return { icon: "table_view", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" };
    default:
      return { icon: "article", color: "bg-slate-100 text-slate-600" };
  }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

interface TrashPageProps {
  onRefreshDocuments?: () => void;
}

export const TrashPage: React.FC<TrashPageProps> = ({ onRefreshDocuments }) => {
  const navigate = useNavigate();
  const [deletedDocuments, setDeletedDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 2500);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await documentsApi.listTrash();
      setDeletedDocuments(docs);
    } catch (err) { console.error("Error cargando papelera:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  const handleRestore = async (doc: ApiDocument) => {
    try {
      setRestoringId(doc.id);
      await documentsApi.restore(doc.id);
      // Esperar animación antes de quitar la card
      await new Promise(r => setTimeout(r, 600));
      setDeletedDocuments(prev => prev.filter(d => d.id !== doc.id));
      setRestoringId(null);
      showToast(`"${doc.name}" restaurado correctamente`);
      onRefreshDocuments?.();
    } catch (err) {
      setRestoringId(null);
      console.error("Error restaurando documento:", err);
    }
  };

  const handlePermanentDelete = async (doc: ApiDocument) => {
    if (!confirm(`¿Eliminar permanentemente "${doc.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await documentsApi.permanentDelete(doc.id);
      setDeletedDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) { console.error("Error eliminando documento:", err); }
  };

  const handleOpenDocument = (doc: ApiDocument) => {
    if (openingId || restoringId) return;
    setOpeningId(doc.id);
    setTimeout(() => {
      navigate(getDocumentRoute(doc.id, doc.type));
    }, 400);
  };

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-2">
        <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <span>/</span><span className="text-[#111318] dark:text-white">Papelera</span>
        </nav>
        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">delete</span>
          Papelera
        </h1>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
          Documentos eliminados. Puedes restaurarlos para recuperarlos.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-[#1a212f] p-6 rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
              <div className="flex items-start justify-between mb-4"><div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : deletedDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border border-dashed border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm">
          <span className="material-symbols-outlined text-6xl text-[#616f89] dark:text-[#a0aec0] mb-4">delete</span>
          <p className="text-xl font-bold text-[#111318] dark:text-white text-center">
            No hay documentos en la papelera
          </p>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-sm mt-1 text-center">
            Los documentos que elimines aparecerán aquí
          </p>
          <Link
            to="/"
            className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors inline-block"
          >
            Volver al inicio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deletedDocuments.map((doc) => {
            const { icon, color } = getFileIcon(doc.type);
            return (
              <article
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenDocument(doc)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpenDocument(doc); } }}
                className={`min-w-0 bg-white dark:bg-[#1a212f] p-5 rounded-2xl border transition-all cursor-pointer flex flex-col shadow-sm group relative overflow-hidden ${restoringId === doc.id
                    ? "border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20 scale-95 opacity-0"
                    : openingId === doc.id
                    ? "border-primary ring-2 ring-primary/20 bg-slate-50 dark:bg-[#101622]"
                    : "border-[#dbdfe6] dark:border-[#2d3748] hover:border-primary hover:-translate-y-1 hover:shadow-md"
                  }`}
                style={{ transition: 'all 0.3s ease-in-out' }}
              >
                {openingId === doc.id && (
                  <div className="absolute inset-0 z-10 bg-white/60 dark:bg-[#1a212f]/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 animate-pulse">
                    <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-3"></div>
                    <div className="h-3 bg-slate-300 dark:bg-slate-600 rounded w-3/4 mb-2"></div>
                    <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded w-1/2"></div>
                  </div>
                )}
                
                <header className="flex items-start justify-between gap-3 mb-3">
                  <div className={`p-3 ${color} rounded-xl shrink-0 group-hover:scale-105 transition-transform`} aria-hidden>
                    <span className="material-symbols-outlined text-[28px] font-bold">{icon}</span>
                  </div>
                  {doc.deletedAt && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#616f89] dark:text-[#a0aec0] bg-[#e2e6eb] dark:bg-[#2d3748] px-2 py-1 rounded-md">
                      Eliminado {formatDate(doc.deletedAt)}
                    </span>
                  )}
                </header>
                <h3 className="text-lg font-extrabold mb-2 text-[#111318] dark:text-white break-normal leading-tight flex-grow min-w-0 group-hover:text-primary transition-colors">
                  {doc.name.split("_").map((part, i) =>
                    i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                  )}
                </h3>
                <p className="flex items-center gap-1.5 text-[#616f89] dark:text-[#a0aec0] font-medium text-xs mb-4">
                  <span className="material-symbols-outlined text-base shrink-0" aria-hidden>calendar_today</span>
                  <span>Modificado el {formatDate(doc.updatedAt)}</span>
                </p>
                <div className="flex gap-2 mt-auto pt-4 border-t border-[#dbdfe6] dark:border-[#2d3748]" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={restoringId === doc.id || openingId === doc.id}
                    onClick={(e) => { e.stopPropagation(); handleRestore(doc); }}
                    className={`flex-1 min-h-[40px] py-2 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${restoringId === doc.id
                        ? "bg-green-500 text-white cursor-wait"
                        : "bg-primary/10 hover:bg-primary/20 text-primary"
                      }`}
                  >
                    <span className={`material-symbols-outlined text-base ${restoringId === doc.id ? "animate-spin" : ""}`}>
                      {restoringId === doc.id ? "sync" : "restore"}
                    </span>
                    {restoringId === doc.id ? "Restaurando..." : "Restaurar"}
                  </button>
                  <button
                    type="button"
                    disabled={restoringId === doc.id || openingId === doc.id}
                    onClick={(e) => { e.stopPropagation(); handlePermanentDelete(doc); }}
                    className="min-h-[40px] py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Eliminar permanentemente"
                  >
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Toast de restauración */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-500 ${toast.visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
            } bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200`}
        >
          <span className="material-symbols-outlined text-2xl text-green-600 dark:text-green-400">check_circle</span>
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}
    </main>
  );
};
