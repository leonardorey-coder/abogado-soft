import React from "react";
import { ViewState, Document } from "../types";

const getFileIcon = (type: string) => {
  switch (type) {
    case "DOCX":
      return { icon: "description", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    case "PDF":
      return { icon: "picture_as_pdf", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    case "XLSX":
      return { icon: "table_view", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" };
    default:
      return { icon: "article", color: "bg-slate-100 text-slate-600" };
  }
};

interface TrashPageProps {
  deletedDocuments: Document[];
  onRestore: (doc: Document) => void;
  onOpenDocument: (doc: Document) => void;
  onEmptyTrash: () => void;
  onNavigate: (view: ViewState) => void;
}

export const TrashPage: React.FC<TrashPageProps> = ({
  deletedDocuments,
  onRestore,
  onOpenDocument,
  onEmptyTrash,
  onNavigate,
}) => {
  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black tracking-tight dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">delete</span>
          Papelera
        </h2>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
          Documentos eliminados. Puedes restaurarlos o vaciar la papelera.
        </p>
      </div>

      {deletedDocuments.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onEmptyTrash}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete_forever</span>
            Vaciar papelera
          </button>
        </div>
      )}

      {deletedDocuments.length === 0 ? (
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
                onClick={() => onOpenDocument(doc)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDocument(doc); } }}
                className="min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all cursor-pointer flex flex-col"
              >
                <header className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-4 ${color} rounded-xl shrink-0`} aria-hidden>
                    <span className="material-symbols-outlined text-[32px] font-bold">{icon}</span>
                  </div>
                </header>
                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {doc.name.split("_").map((part, i) =>
                    i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                  )}
                </h3>
                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-4">
                  <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>calendar_today</span>
                  <span>{doc.lastModified}</span>
                </p>
                <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRestore(doc); }}
                    className="flex-1 min-h-[44px] py-3 bg-primary text-white hover:bg-primary/90 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">restore</span>
                    Restaurar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
};
