import React from "react";
import { ViewState } from "../types";

interface AgreementsListProps {
  onNavigate: (view: ViewState) => void;
}

export const AgreementsList: React.FC<AgreementsListProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col flex-1 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <main className="flex-1 flex justify-center py-8">
        <div className="layout-content-container flex flex-col max-w-[1200px] w-full px-6 md:px-10">
          {/* Page Heading */}
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <div className="flex flex-col gap-2">
              <nav className="flex gap-2 text-sm text-slate-500 font-medium mb-1">
                <a 
                    className="hover:text-primary cursor-pointer"
                    onClick={() => onNavigate(ViewState.DASHBOARD)}
                >
                    Inicio
                </a>
                <span>/</span>
                <span className="text-slate-900 dark:text-slate-100">
                  Convenios
                </span>
              </nav>
              <h1 className="text-slate-900 dark:text-white text-5xl font-black leading-tight tracking-tight">
                Gestión de Convenios
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-xl font-medium">
                Administre y visualice los acuerdos legales de la universidad
                con total claridad.
              </p>
            </div>
            <button className="bg-primary hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all">
              <span className="material-symbols-outlined">add_circle</span>
              Nuevo Convenio
            </button>
          </div>

          {/* Accessibility Warning */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 mb-8 rounded-r-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                info
              </span>
              <p className="text-primary dark:text-blue-300 font-semibold text-lg">
                Modo de Alta Legibilidad activado: Texto grande y alto
                contraste.
              </p>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-2 min-w-[240px]">
                <label className="text-slate-900 dark:text-white font-bold text-lg px-1">
                  Filtrar por Estado
                </label>
                <div className="relative">
                  <select className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-lg font-bold text-slate-900 dark:text-white focus:border-primary focus:ring-0 cursor-pointer pr-10">
                    <option>Todos los estados</option>
                    <option>Activo</option>
                    <option>Pendiente</option>
                    <option>Expirado</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    expand_more
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 min-w-[200px]">
                <label className="text-slate-900 dark:text-white font-bold text-lg px-1">
                  Filtrar por Año
                </label>
                <div className="relative">
                  <select className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-lg font-bold text-slate-900 dark:text-white focus:border-primary focus:ring-0 cursor-pointer pr-10">
                    <option>2024</option>
                    <option>2023</option>
                    <option>2022</option>
                    <option>Anteriores</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    calendar_today
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-3 mt-auto h-[76px] pb-1">
                <button className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white px-6 py-4 rounded-xl font-bold text-lg transition-colors">
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filters Chips */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <button className="flex items-center gap-2 rounded-full bg-primary text-white px-6 py-2 font-bold shadow-md">
              <span className="material-symbols-outlined text-xl">
                check_circle
              </span>
              Todos (42)
            </button>
            <button className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 font-bold hover:border-primary transition-all">
              <span className="material-symbols-outlined text-xl text-green-600">
                verified
              </span>
              Activos (28)
            </button>
            <button className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 font-bold hover:border-primary transition-all">
              <span className="material-symbols-outlined text-xl text-orange-600">
                pending
              </span>
              Pendientes (10)
            </button>
            <button className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-6 py-2 font-bold hover:border-primary transition-all">
              <span className="material-symbols-outlined text-xl text-red-600">
                error
              </span>
              Expirados (4)
            </button>
          </div>

          {/* Main Spreadsheet-like Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-6 text-slate-900 dark:text-white text-lg font-extrabold uppercase tracking-wider w-[20%]">
                    Nº de Convenio
                  </th>
                  <th className="px-6 py-6 text-slate-900 dark:text-white text-lg font-extrabold uppercase tracking-wider w-[35%]">
                    Institución Colaboradora
                  </th>
                  <th className="px-6 py-6 text-slate-900 dark:text-white text-lg font-extrabold uppercase tracking-wider w-[15%] text-center">
                    Fecha Firma
                  </th>
                  <th className="px-6 py-6 text-slate-900 dark:text-white text-lg font-extrabold uppercase tracking-wider w-[15%] text-center">
                    Estado
                  </th>
                  <th className="px-6 py-6 text-slate-900 dark:text-white text-lg font-extrabold uppercase tracking-wider w-[15%] text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Row 1 */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-8 text-slate-900 dark:text-white text-xl font-bold">
                    C-2023-001
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        Universidad Nacional de Colombia
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-base">
                        Facultad de Derecho
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-slate-700 dark:text-slate-300 text-xl font-medium text-center">
                    15 Ene 2023
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                      <span className="size-2.5 rounded-full bg-green-600"></span>
                      <span className="font-black text-lg uppercase">
                        Activo
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <button 
                        onClick={() => onNavigate(ViewState.EDITOR)}
                        className="bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ml-auto">
                      <span className="material-symbols-outlined">
                        visibility
                      </span>
                      Ver
                    </button>
                  </td>
                </tr>
                {/* Row 2 */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-8 text-slate-900 dark:text-white text-xl font-bold">
                    C-2023-012
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        Banco Central del Estado
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-base">
                        Convenio de Prácticas
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-slate-700 dark:text-slate-300 text-xl font-medium text-center">
                    02 Feb 2023
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                      <span className="size-2.5 rounded-full bg-orange-600"></span>
                      <span className="font-black text-lg uppercase">
                        Pendiente
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <button 
                         onClick={() => onNavigate(ViewState.EDITOR)}
                         className="bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ml-auto">
                      <span className="material-symbols-outlined">
                        visibility
                      </span>
                      Ver
                    </button>
                  </td>
                </tr>
                {/* Row 3 */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-8 text-slate-900 dark:text-white text-xl font-bold">
                    C-2022-089
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        Ministerio de Educación Pública
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-base">
                        Marco de Cooperación
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-slate-700 dark:text-slate-300 text-xl font-medium text-center">
                    10 Nov 2022
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                      <span className="size-2.5 rounded-full bg-red-600"></span>
                      <span className="font-black text-lg uppercase">
                        Expirado
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <button 
                        onClick={() => onNavigate(ViewState.EDITOR)}
                        className="bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ml-auto">
                      <span className="material-symbols-outlined">
                        visibility
                      </span>
                      Ver
                    </button>
                  </td>
                </tr>
                {/* Row 4 */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-8 text-slate-900 dark:text-white text-xl font-bold">
                    C-2023-045
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        Fundación Legal Internacional
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-base">
                        Investigación Académica
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-slate-700 dark:text-slate-300 text-xl font-medium text-center">
                    22 Mar 2023
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                      <span className="size-2.5 rounded-full bg-green-600"></span>
                      <span className="font-black text-lg uppercase">
                        Activo
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <button 
                         onClick={() => onNavigate(ViewState.EDITOR)}
                         className="bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ml-auto">
                      <span className="material-symbols-outlined">
                        visibility
                      </span>
                      Ver
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-8 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <button className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xl font-bold text-slate-600 dark:text-slate-300 hover:border-primary transition-all">
                <span className="material-symbols-outlined">arrow_back</span>
                Anterior
              </button>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                Página <span className="text-primary">1</span> de 5
              </div>
              <button className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xl font-bold text-primary hover:border-primary transition-all">
                Siguiente
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Footer Summary */}
          <div className="mt-8 flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium p-4">
            <p className="text-lg">
              Mostrando 4 de 42 convenios totales registrados en el sistema.
            </p>
            <button className="flex items-center gap-2 hover:text-primary underline font-bold text-lg transition-colors">
              <span className="material-symbols-outlined text-xl">
                download
              </span>
              Exportar lista a PDF/Excel
            </button>
          </div>
        </div>
      </main>

      <button className="fixed bottom-8 right-8 size-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50">
        <span className="material-symbols-outlined text-3xl">help_center</span>
      </button>
    </div>
  );
};