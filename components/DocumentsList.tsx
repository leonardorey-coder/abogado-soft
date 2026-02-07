import React, { useState } from "react";
import { ViewState, Document, FileStatus } from "../types";

interface DocumentsListProps {
  onNavigate: (view: ViewState) => void;
}

const initialDocuments: Document[] = [
  {
    id: "1",
    name: "Contrato_Docente_Titular_2024.docx",
    type: "DOCX",
    lastModified: "Hace 2 horas",
    timeAgo: "2h",
    fileStatus: "ACTIVO",
    expirationDate: "2024-12-31"
  },
  {
    id: "2",
    name: "Resolucion_Rectoral_N045.pdf",
    type: "PDF",
    lastModified: "Ayer, 14:00",
    timeAgo: "1d",
    fileStatus: "ACTIVO",
    collaborationStatus: "VISTO"
  },
  {
    id: "3",
    name: "Presupuesto_Facultad_Derecho.xlsx",
    type: "XLSX",
    lastModified: "15 Oct 2024",
    timeAgo: "1w",
    fileStatus: "ACTIVO",
    collaborationStatus: "EDITADO"
  },
  {
    id: "4",
    name: "Convenio_Marco_Interinstitucional.pdf",
    type: "PDF",
    lastModified: "10 Oct 2024",
    timeAgo: "2w",
    fileStatus: "PENDIENTE",
    sharingStatus: "ENVIADO",
    expirationDate: "2024-10-30"
  },
  {
    id: "5",
    name: "Dictamen_Legal_Proyecto_A.pdf",
    type: "PDF",
    lastModified: "Hace 1 hora",
    timeAgo: "1h",
    fileStatus: "ACTIVO",
    sharingStatus: "ASIGNADO"
  },
  {
    id: "6",
    name: "Acta_Comite_Etica_Antigua.docx",
    type: "DOCX",
    lastModified: "20 Sep 2023",
    timeAgo: "1y",
    fileStatus: "INACTIVO"
  }
];

const getFileStatusBadge = (status: FileStatus) => {
  switch (status) {
    case "ACTIVO":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
    case "PENDIENTE":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "INACTIVO":
      return "bg-[#e2e6eb] dark:bg-[#2d3748] text-[#616f89] dark:text-[#a0aec0] border-[#dbdfe6] dark:border-[#2d3748]";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "DOCX": return "description";
    case "PDF": return "picture_as_pdf";
    case "XLSX": return "table_view";
    default: return "article";
  }
};

export const DocumentsList: React.FC<DocumentsListProps> = ({ onNavigate }) => {
  const [documents] = useState<Document[]>(initialDocuments);
  const [filter, setFilter] = useState<"TODOS" | FileStatus>("TODOS");
  const [page, setPage] = useState(1);
  const perPage = 5;
  const totalPages = Math.ceil(documents.length / perPage) || 1;

  const filtered =
    filter === "TODOS"
      ? documents
      : documents.filter((d) => d.fileStatus === filter);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const counts = {
    todos: documents.length,
    activos: documents.filter((d) => d.fileStatus === "ACTIVO").length,
    pendientes: documents.filter((d) => d.fileStatus === "PENDIENTE").length,
    inactivos: documents.filter((d) => d.fileStatus === "INACTIVO").length
  };

  const handleVer = (doc: Document) => {
    if (doc.type === "XLSX") onNavigate(ViewState.EXCEL_EDITOR);
    else onNavigate(ViewState.EDITOR);
  };

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
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
            <span className="text-[#111318] dark:text-white">Documentos</span>
          </nav>
          <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">
            Gestión de Documentos
          </h1>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
            Administre y visualice los documentos del despacho con total claridad.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(ViewState.EDITOR)}
          className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Documento
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
              Filtrar por Estado
            </label>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as "TODOS" | FileStatus);
                  setPage(1);
                }}
                className="appearance-none w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 cursor-pointer pr-10"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="ACTIVO">Activo</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#616f89]">
                expand_more
              </span>
            </div>
          </div>
          <div className="flex items-end gap-3 mt-auto h-[72px] pb-1">
            <button
              type="button"
              onClick={() => setFilter("TODOS")}
              className="bg-[#e2e6eb] dark:bg-[#2d3748] hover:bg-[#dbdfe6] dark:hover:bg-[#374151] text-[#111318] dark:text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter("TODOS")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all ${filter === "TODOS" ? "bg-primary text-white" : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}`}
        >
          <span className="material-symbols-outlined text-xl">check_circle</span>
          Todos ({counts.todos})
        </button>
        <button
          type="button"
          onClick={() => setFilter("ACTIVO")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all ${filter === "ACTIVO" ? "bg-primary text-white" : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}`}
        >
          <span className="material-symbols-outlined text-xl text-green-600">verified</span>
          Activos ({counts.activos})
        </button>
        <button
          type="button"
          onClick={() => setFilter("PENDIENTE")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all ${filter === "PENDIENTE" ? "bg-primary text-white" : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}`}
        >
          <span className="material-symbols-outlined text-xl text-orange-600">pending</span>
          Pendientes ({counts.pendientes})
        </button>
        <button
          type="button"
          onClick={() => setFilter("INACTIVO")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all ${filter === "INACTIVO" ? "bg-primary text-white" : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"}`}
        >
          <span className="material-symbols-outlined text-xl text-red-600">error</span>
          Inactivos ({counts.inactivos})
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-light dark:bg-[#101622] border-b border-[#dbdfe6] dark:border-[#2d3748]">
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">
                Nombre
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[12%]">
                Tipo
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[23%]">
                Última modificación
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">
                Estado
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
            {paginated.map((doc) => (
              <tr
                key={doc.id}
                className="hover:bg-background-light dark:hover:bg-[#101622]/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#616f89] dark:text-[#a0aec0]">
                      {getTypeIcon(doc.type)}
                    </span>
                    <span className="text-[#111318] dark:text-white font-bold text-base truncate max-w-[240px]">
                      {doc.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] font-medium text-sm">
                  {doc.type}
                </td>
                <td className="px-6 py-4 text-[#616f89] dark:text-[#a0aec0] text-sm">
                  {doc.lastModified}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase ${getFileStatusBadge(doc.fileStatus)}`}
                  >
                    <span className="size-2 rounded-full bg-current opacity-70" />
                    {doc.fileStatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleVer(doc)}
                    className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ml-auto"
                  >
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-4 bg-background-light dark:bg-[#101622] flex items-center justify-between border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:border-primary disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Anterior
          </button>
          <span className="text-sm font-bold text-[#111318] dark:text-white">
            Página <span className="text-primary">{page}</span> de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl text-sm font-bold text-primary hover:border-primary disabled:opacity-50 transition-colors"
          >
            Siguiente
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4 text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">
        <p>
          Mostrando {paginated.length} de {filtered.length} documentos
          {filter !== "TODOS" ? " (filtrado)" : ""}.
        </p>
        <button
          type="button"
          className="flex items-center gap-2 hover:text-primary font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Exportar lista a PDF/Excel
        </button>
      </div>
    </main>
  );
};
