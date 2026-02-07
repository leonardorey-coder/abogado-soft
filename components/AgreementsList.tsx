import React, { useState, useMemo } from "react";
import { ViewState } from "../types";

interface AgreementsListProps {
  onNavigate: (view: ViewState) => void;
}

type EstadoConvenio = "ACTIVO" | "PENDIENTE" | "EXPIRADO";

interface Convenio {
  id: string;
  numero: string;
  institucion: string;
  subtexto: string;
  fecha: string;
  estado: EstadoConvenio;
}

const CONVENIOS_BASE: Convenio[] = [
  { id: "1", numero: "C-2023-001", institucion: "Universidad Nacional de Colombia", subtexto: "Facultad de Derecho", fecha: "15 Ene 2023", estado: "ACTIVO" },
  { id: "2", numero: "C-2023-012", institucion: "Banco Central del Estado", subtexto: "Convenio de Prácticas", fecha: "02 Feb 2023", estado: "PENDIENTE" },
  { id: "3", numero: "C-2022-089", institucion: "Ministerio de Educación Pública", subtexto: "Marco de Cooperación", fecha: "10 Nov 2022", estado: "EXPIRADO" },
  { id: "4", numero: "C-2023-045", institucion: "Fundación Legal Internacional", subtexto: "Investigación Académica", fecha: "22 Mar 2023", estado: "ACTIVO" },
];

function buildConveniosList(): Convenio[] {
  const list: Convenio[] = [];
  for (let i = 0; i < 42; i++) {
    const base = CONVENIOS_BASE[i % CONVENIOS_BASE.length];
    const year = 2022 + (i % 3);
    const num = String(i + 1).padStart(3, "0");
    list.push({
      ...base,
      id: `conv-${i + 1}`,
      numero: `C-${year}-${num}`,
    });
  }
  return list;
}

const CONVENIOS = buildConveniosList();
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

export const AgreementsList: React.FC<AgreementsListProps> = ({ onNavigate }) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(CONVENIOS.length / PER_PAGE) || 1;
  const paginated = useMemo(
    () => CONVENIOS.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page]
  );
  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, CONVENIOS.length);

  return (
    <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
            <button type="button" className="hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>
              Inicio
            </button>
            <span>/</span>
            <span className="text-[#111318] dark:text-white">Convenios</span>
          </nav>
          <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">
            Gestión de Convenios
          </h1>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
            Administre y visualice los acuerdos legales de la universidad con total claridad.
          </p>
        </div>
        <button type="button" className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors">
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Convenio
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
              Filtrar por Estado
            </label>
            <div className="relative">
              <select className="appearance-none w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 cursor-pointer pr-10">
                <option>Todos los estados</option>
                <option>Activo</option>
                <option>Pendiente</option>
                <option>Expirado</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#616f89]">
                expand_more
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[180px]">
            <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
              Filtrar por Año
            </label>
            <div className="relative">
              <select className="appearance-none w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 cursor-pointer pr-10">
                <option>2024</option>
                <option>2023</option>
                <option>2022</option>
                <option>Anteriores</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#616f89]">
                calendar_today
              </span>
            </div>
          </div>
          <div className="flex items-end gap-3 mt-auto h-[72px] pb-1">
            <button type="button" className="bg-[#e2e6eb] dark:bg-[#2d3748] hover:bg-[#dbdfe6] dark:hover:bg-[#374151] text-[#111318] dark:text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors">
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <button type="button" className="flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all bg-primary text-white">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          Todos (42)
        </button>
        <button type="button" className="flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary">
          <span className="material-symbols-outlined text-xl text-green-600">verified</span>
          Activos (28)
        </button>
        <button type="button" className="flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary">
          <span className="material-symbols-outlined text-xl text-orange-600">pending</span>
          Pendientes (10)
        </button>
        <button type="button" className="flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary">
          <span className="material-symbols-outlined text-xl text-red-600">error</span>
          Expirados (4)
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background-light dark:bg-[#101622] border-b border-[#dbdfe6] dark:border-[#2d3748]">
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[20%]">
                Nº de Convenio
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[35%]">
                Institución Colaboradora
              </th>
              <th className="px-6 py-4 text-[#111318] dark:text-white text-sm font-extrabold uppercase tracking-wider w-[15%] text-center">
                Fecha Firma
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
            {paginated.map((c) => (
              <tr key={c.id} className="hover:bg-[#f6f6f8] dark:hover:bg-[#101622]/50 transition-colors">
                <td className="px-6 py-5 text-[#111318] dark:text-white font-bold">{c.numero}</td>
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-[#111318] dark:text-white font-bold">{c.institucion}</span>
                    <span className="text-[#616f89] dark:text-[#a0aec0] text-sm">{c.subtexto}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-[#616f89] dark:text-[#a0aec0] font-medium text-center">{c.fecha}</td>
                <td className="px-6 py-5 text-center">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold uppercase ${estadoStyles[c.estado]}`}>
                    <span className={`size-2 rounded-full ${estadoDot[c.estado]}`} /> {c.estado === "ACTIVO" ? "Activo" : c.estado === "PENDIENTE" ? "Pendiente" : "Expirado"}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button type="button" onClick={() => onNavigate(ViewState.EDITOR)} className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 ml-auto">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-5 bg-background-light dark:bg-[#101622] flex items-center justify-between border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl font-bold text-sm text-[#616f89] dark:text-[#a0aec0] hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#dbdfe6] dark:disabled:hover:border-[#2d3748]"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Anterior
          </button>
          <div className="text-sm font-bold text-[#111318] dark:text-white">
            Página <span className="text-primary">{page}</span> de {totalPages}
          </div>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl font-bold text-sm text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#dbdfe6] dark:disabled:hover:border-[#2d3748]"
          >
            Siguiente
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4 text-[#616f89] dark:text-[#a0aec0] text-sm p-2">
        <p>Mostrando {from}-{to} de {CONVENIOS.length} convenios totales registrados en el sistema.</p>
        <button type="button" className="flex items-center gap-2 hover:text-primary font-bold transition-colors">
          <span className="material-symbols-outlined">download</span>
          Exportar lista a PDF/Excel
        </button>
      </div>
    </main>
  );
};