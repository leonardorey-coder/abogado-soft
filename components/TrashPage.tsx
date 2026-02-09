import React, { useState, useEffect, useCallback } from "react";
import { ViewState } from "../types";
import { documentsApi, ApiDocument } from "../lib/api";

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
  onNavigate: (view: ViewState) => void;
  onRefreshDocuments?: () => void;
}

export const TrashPage: React.FC<TrashPageProps> = ({ onNavigate, onRefreshDocuments }) => {
  const [deletedDocuments, setDeletedDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
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
    const t = doc.type?.toUpperCase();
    if (t === "XLSX" || t === "XLS") onNavigate(ViewState.EXCEL_EDITOR);
    else onNavigate(ViewState.EDITOR);
  };

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black tracking-tight dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">delete</span>
          Papelera
        </h2>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
          Documentos eliminados. Puedes restaurarlos para recuperarlos.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between mb-4"><div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : deletedDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <span className="material-symbols-outlined text-6xl text-slate-400 dark:text-slate-500 mb-4">delete</span>
          <p className="text-xl font-bold text-slate-600 dark:text-slate-400 text-center">
            No hay documentos en la papelera
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-1 text-center">
            Los documentos que elimines aparecerán aquí
          </p>
          <button
            type="button"
            onClick={() => onNavigate(ViewState.DASHBOARD)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
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
                className={`min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col ${
                  restoringId === doc.id
                    ? "border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20 scale-95 opacity-0"
                    : "border-slate-100 dark:border-slate-700 hover:border-primary"
                }`}
                style={{ transition: 'all 0.5s ease-in-out' }}
              >
                <header className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-4 ${color} rounded-xl shrink-0`} aria-hidden>
                    <span className="material-symbols-outlined text-[32px] font-bold">{icon}</span>
                  </div>
                  {doc.deletedAt && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      Eliminado {formatDate(doc.deletedAt)}
                    </span>
                  )}
                </header>
                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {doc.name.split("_").map((part, i) =>
                    i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                  )}
                </h3>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-4">
                  <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>calendar_today</span>
                  <span>{formatDate(doc.updatedAt)}</span>
                </p>
                <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={restoringId === doc.id}
                    onClick={(e) => { e.stopPropagation(); handleRestore(doc); }}
                    className={`flex-1 min-h-[44px] py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                      restoringId === doc.id
                        ? "bg-green-500 text-white cursor-wait"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg ${restoringId === doc.id ? "animate-spin" : ""}`}>
                      {restoringId === doc.id ? "sync" : "restore"}
                    </span>
                    {restoringId === doc.id ? "Restaurando..." : "Restaurar"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePermanentDelete(doc); }}
                    className="min-h-[44px] py-3 px-4 bg-red-500 text-white hover:bg-red-600 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    title="Eliminar permanentemente"
                  >
                    <span className="material-symbols-outlined text-lg">delete_forever</span>
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
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-500 ${
            toast.visible
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
