import React, { useState } from "react";
import { ViewState, Document, FileStatus } from "../types";

interface AssignedListProps {
  onNavigate: (view: ViewState) => void;
}

const assignedDocuments: Document[] = [
  {
    id: "4",
    name: "Convenio_Marco_Interinstitucional.pdf",
    type: "PDF",
    lastModified: "10 Oct 2024",
    timeAgo: "2w",
    fileStatus: "PENDIENTE",
    sharingStatus: "ASIGNADO",
    expirationDate: "2024-10-30"
  },
  {
    id: "5",
    name: "Dictamen_Legal_Proyecto_A.pdf",
    type: "PDF",
    lastModified: "Hace 1 hora",
    timeAgo: "1h",
    fileStatus: "ACTIVO",
    sharingStatus: "ASIGNADO",
    collaborationStatus: "REVISADO"
  },
  {
    id: "7",
    name: "Informe_Compliance_2024.docx",
    type: "DOCX",
    lastModified: "Hace 3 días",
    timeAgo: "3d",
    fileStatus: "ACTIVO",
    sharingStatus: "ASIGNADO",
    collaborationStatus: "VISTO"
  }
];

const getFileStatusColor = (status: FileStatus) => {
  switch (status) {
    case "ACTIVO": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "PENDIENTE": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
    case "INACTIVO": return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600";
    default: return "bg-gray-100 text-gray-600";
  }
};

const getFileIcon = (type: string) => {
  switch (type) {
    case "DOCX": return { icon: "description", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    case "PDF": return { icon: "picture_as_pdf", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    case "XLSX": return { icon: "table_view", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" };
    default: return { icon: "article", color: "bg-slate-100 text-slate-600" };
  }
};

type FilterAssigned = "TODOS" | "PENDIENTES" | "REVISADOS" | "ACTIVOS";

export const AssignedList: React.FC<AssignedListProps> = ({ onNavigate }) => {
  const [documents] = useState<Document[]>(assignedDocuments);
  const [filter, setFilter] = useState<FilterAssigned>("TODOS");

  const counts = {
    todos: documents.length,
    pendientes: documents.filter((d) => d.fileStatus === "PENDIENTE").length,
    revisados: documents.filter((d) => d.collaborationStatus === "REVISADO" || d.collaborationStatus === "VISTO").length,
    activos: documents.filter((d) => d.fileStatus === "ACTIVO").length
  };

  const filteredDocuments = documents.filter((doc) => {
    if (filter === "TODOS") return true;
    if (filter === "PENDIENTES") return doc.fileStatus === "PENDIENTE";
    if (filter === "REVISADOS") return doc.collaborationStatus === "REVISADO" || doc.collaborationStatus === "VISTO";
    if (filter === "ACTIVOS") return doc.fileStatus === "ACTIVO";
    return true;
  });

  const handleDocumentClick = (doc: Document) => {
    if (doc.type === "XLSX") onNavigate(ViewState.EXCEL_EDITOR);
    else onNavigate(ViewState.EDITOR);
  };

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-col gap-2">
        <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
          <button
            type="button"
            className="hover:text-primary cursor-pointer"
            onClick={() => onNavigate(ViewState.DASHBOARD)}
          >
            Inicio
          </button>
          <span>/</span>
          <span className="text-[#111318] dark:text-white">Asignados</span>
        </nav>
        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">
          Documentos asignados
        </h1>
        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
          Documentos compartidos y asignados a usted.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Pendientes</p>
            <span className="material-symbols-outlined text-primary">pending</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold dark:text-white">{counts.pendientes}</p>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Por revisar</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Revisados</p>
            <span className="material-symbols-outlined text-primary">visibility</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold dark:text-white">{counts.revisados}</p>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Visto o revisado</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Activos</p>
            <span className="material-symbols-outlined text-primary">verified</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold dark:text-white">{counts.activos}</p>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Estado de archivo</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos asignados</p>
            <span className="material-symbols-outlined text-primary">description</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold dark:text-white">{counts.todos}</p>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Total en lista</p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
          <span className="material-symbols-outlined text-primary">history</span>
          Asignados recientes
        </h3>
      </div>

      <div className="flex gap-4 flex-wrap overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setFilter("TODOS")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === "TODOS" ? "bg-primary text-white" : "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}
        >
          <span className="material-symbols-outlined text-xl">check_circle</span>
          Todos ({counts.todos})
        </button>
        <button
          type="button"
          onClick={() => setFilter("PENDIENTES")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === "PENDIENTES" ? "bg-primary text-white border-2 border-primary" : "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}
        >
          <span className={`material-symbols-outlined text-xl ${filter === "PENDIENTES" ? "text-white" : "text-orange-600"}`}>pending</span>
          Pendientes ({counts.pendientes})
        </button>
        <button
          type="button"
          onClick={() => setFilter("REVISADOS")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === "REVISADOS" ? "bg-primary text-white border-2 border-primary" : "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}
        >
          <span className={`material-symbols-outlined text-xl ${filter === "REVISADOS" ? "text-white" : "text-blue-600"}`}>visibility</span>
          Revisados ({counts.revisados})
        </button>
        <button
          type="button"
          onClick={() => setFilter("ACTIVOS")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === "ACTIVOS" ? "bg-primary text-white border-2 border-primary" : "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary"}`}
        >
          <span className={`material-symbols-outlined text-xl ${filter === "ACTIVOS" ? "text-white" : "text-green-600"}`}>verified</span>
          Activos ({counts.activos})
        </button>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-12 text-center">
          <p className="text-slate-600 dark:text-slate-400 font-medium">No hay documentos asignados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="Lista de documentos asignados">
          {filteredDocuments.map((doc) => {
            const { icon, color } = getFileIcon(doc.type);
            const isExpiring = doc.fileStatus === "PENDIENTE" && doc.expirationDate;

            return (
              <article
                key={doc.id}
                role="listitem"
                onClick={() => handleDocumentClick(doc)}
                className="min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all cursor-pointer group shadow-sm relative flex flex-col h-full"
              >
                <header className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-4 ${color} rounded-xl shrink-0`} aria-hidden>
                    <span className="material-symbols-outlined text-[32px] font-bold">{icon}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase border ${getFileStatusColor(doc.fileStatus)}`}>
                      {doc.fileStatus}
                    </span>
                  </div>
                </header>

                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {doc.name.split("_").map((part, i) =>
                    i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                  )}
                </h3>

                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-3">
                  <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>calendar_today</span>
                  <span>{doc.lastModified}</span>
                </p>

                {isExpiring && (
                  <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-100 dark:border-red-900/50" role="alert">
                    <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>warning</span>
                    <span className="text-xs font-bold">Vence el {doc.expirationDate}</span>
                  </div>
                )}

                <footer className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDocumentClick(doc); }}
                    className="w-full min-h-[44px] py-3 bg-primary hover:opacity-90 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden>visibility</span>
                    Ver
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {documents.length > 0 && (
        <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">
          Mostrando {filteredDocuments.length} de {documents.length} documento{documents.length !== 1 ? "s" : ""} asignado{documents.length !== 1 ? "s" : ""}
          {filter !== "TODOS" ? " (filtrado)" : ""}.
        </p>
      )}
    </main>
  );
};
