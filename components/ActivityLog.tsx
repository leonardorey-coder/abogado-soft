import React from "react";
import { ViewState } from "../types";

interface ActivityLogProps {
  onNavigate: (view: ViewState) => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ onNavigate }) => {
  return (
    <div className="relative flex flex-1 w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 justify-center py-6 px-4 md:px-10 lg:px-40">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            {/* Breadcrumbs Component */}
            <div className="flex flex-wrap gap-2 py-2">
              <a
                className="text-[#616f89] dark:text-gray-400 text-sm font-medium leading-normal hover:text-primary cursor-pointer"
                onClick={() => onNavigate(ViewState.DASHBOARD)}
              >
                Inicio
              </a>
              <span className="text-[#616f89] dark:text-gray-600 text-sm font-medium leading-normal">
                /
              </span>
              <a
                className="text-[#616f89] dark:text-gray-400 text-sm font-medium leading-normal hover:text-primary cursor-pointer"
              >
                Expedientes
              </a>
              <span className="text-[#616f89] dark:text-gray-600 text-sm font-medium leading-normal">
                /
              </span>
              <span className="text-[#111318] dark:text-white text-sm font-medium leading-normal">
                Expediente #2023-084
              </span>
            </div>
            {/* PageHeading Component */}
            <div className="flex flex-wrap justify-between items-end gap-3 py-6">
              <div className="flex min-w-72 flex-col gap-2">
                <h1 className="text-[#111318] dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">
                  Bitácora de Actividad
                </h1>
                <p className="text-[#616f89] dark:text-gray-400 text-base font-normal leading-normal">
                  Historial completo de acciones para el expediente:{" "}
                  <span className="font-semibold text-primary">
                    Demanda Civil - Pérez vs. García
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-white dark:bg-gray-800 text-[#111318] dark:text-white text-sm font-bold border border-[#dbdfe6] dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <span className="material-symbols-outlined text-lg">
                    share
                  </span>
                  <span className="truncate">Compartir</span>
                </button>
                <button className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors">
                  <span className="material-symbols-outlined text-lg">
                    download
                  </span>
                  <span className="truncate">Exportar Reporte</span>
                </button>
              </div>
            </div>
            {/* Filter Section (TextGrid + Chips) */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-[#dbdfe6] dark:border-gray-800 mb-8 p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors">
                    <div className="text-primary" data-icon="User">
                      <span className="material-symbols-outlined">
                        person_search
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">
                        Filtrar por
                      </span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight">
                        Abogado responsable
                      </h2>
                    </div>
                    <span className="material-symbols-outlined ml-auto text-gray-400">
                      expand_more
                    </span>
                  </div>
                  <div className="flex flex-1 gap-3 rounded-lg border border-[#dbdfe6] dark:border-gray-700 bg-background-light dark:bg-gray-800 p-3 items-center cursor-pointer hover:border-primary transition-colors">
                    <div className="text-primary" data-icon="Files">
                      <span className="material-symbols-outlined">
                        category
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-[#616f89] dark:text-gray-400">
                        Filtrar por
                      </span>
                      <h2 className="text-[#111318] dark:text-white text-sm font-bold leading-tight">
                        Tipo de acción
                      </h2>
                    </div>
                    <span className="material-symbols-outlined ml-auto text-gray-400">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-4">
                  <span className="text-xs font-bold text-[#616f89] uppercase tracking-wider mr-2">
                    Periodo:
                  </span>
                  <button className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-primary/10 text-primary border border-primary/20 px-4 transition-colors">
                    <p className="text-sm font-semibold leading-normal">Hoy</p>
                    <span className="material-symbols-outlined text-sm">
                      close
                    </span>
                  </button>
                  <button className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 px-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <p className="text-sm font-medium leading-normal">
                      Última semana
                    </p>
                  </button>
                  <button className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 px-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <p className="text-sm font-medium leading-normal">
                      Este mes
                    </p>
                  </button>
                  <button className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-100 dark:bg-gray-800 text-[#111318] dark:text-gray-300 px-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <p className="text-sm font-medium leading-normal">
                      Personalizado
                    </p>
                    <span className="material-symbols-outlined text-sm">
                      calendar_today
                    </span>
                  </button>
                </div>
              </div>
            </div>
            {/* Activity Timeline */}
            <div className="relative flex flex-col gap-8 pl-2">
                {/* CSS Line replacement */}
                <div className="absolute left-[20px] top-0 bottom-0 w-0.5 bg-[#dbdfe6] dark:bg-gray-700"></div>
                
              {/* Timeline Group: Today */}
              <div className="flex flex-col gap-4 relative">
                <div className="flex items-center gap-4 mb-2">
                  <div className="z-10 bg-primary size-3 rounded-full ml-[14.5px] border-4 border-white dark:border-background-dark outline outline-1 outline-primary"></div>
                  <h3 className="text-xs font-bold text-[#616f89] dark:text-gray-400 uppercase tracking-widest">
                    Hoy - 24 de Octubre, 2023
                  </h3>
                </div>
                {/* Entry 1 */}
                <div className="flex items-start gap-6 relative group">
                  <div className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-primary border-2 border-white dark:border-background-dark shadow-sm">
                    <span className="material-symbols-outlined text-xl">
                      download
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[#111318] dark:text-white font-medium">
                        <span className="font-bold">Carlos Mendoza</span>{" "}
                        descargó el archivo{" "}
                        <span className="italic text-primary cursor-pointer hover:underline">
                          Contrato_Arrendamiento_V2.pdf
                        </span>
                      </p>
                      <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">
                        14:20 PM
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-[#616f89] dark:text-gray-400">
                        DESCARGA
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-primary">
                        LEGAL
                      </span>
                    </div>
                  </div>
                </div>
                {/* Entry 2 */}
                <div className="flex items-start gap-6 relative group">
                  <div className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 border-2 border-white dark:border-background-dark shadow-sm">
                    <span className="material-symbols-outlined text-xl">
                      rule
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[#111318] dark:text-white font-medium">
                        <span className="font-bold">María Valdés</span> cambió
                        el estado del expediente a{" "}
                        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
                          Revisado
                        </span>
                      </p>
                      <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">
                        11:05 AM
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      "Se han verificado todos los anexos solicitados por el
                      juez."
                    </p>
                  </div>
                </div>
              </div>
              {/* Timeline Group: Yesterday */}
              <div className="flex flex-col gap-4 relative">
                <div className="flex items-center gap-4 mb-2">
                  <div className="z-10 bg-gray-400 size-3 rounded-full ml-[14.5px] border-4 border-white dark:border-background-dark"></div>
                  <h3 className="text-xs font-bold text-[#616f89] dark:text-gray-400 uppercase tracking-widest">
                    Ayer - 23 de Octubre, 2023
                  </h3>
                </div>
                {/* Entry 3 */}
                <div className="flex items-start gap-6 relative group">
                  <div className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 border-2 border-white dark:border-background-dark shadow-sm">
                    <span className="material-symbols-outlined text-xl">
                      upload_file
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[#111318] dark:text-white font-medium">
                        <span className="font-bold">Jorge Ramírez</span> subió
                        una nueva versión de{" "}
                        <span className="font-semibold text-primary underline decoration-primary/30 cursor-pointer">
                          Escrito_Demanda_Final.docx
                        </span>
                      </p>
                      <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">
                        16:45 PM
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                      <span className="material-symbols-outlined text-gray-400">
                        description
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold dark:text-gray-300">
                          v3.0 - Última versión
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">
                          2.4 MB • Word Document
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Entry 4 */}
                <div className="flex items-start gap-6 relative group">
                  <div className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 border-2 border-white dark:border-background-dark shadow-sm">
                    <span className="material-symbols-outlined text-xl">
                      event
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 rounded-xl bg-white dark:bg-gray-900 border border-[#dbdfe6] dark:border-gray-800 p-4 shadow-sm group-hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[#111318] dark:text-white font-medium">
                        <span className="font-bold">Sistema</span> agendó una
                        nueva{" "}
                        <span className="font-bold text-orange-600">
                          Audiencia de Conciliación
                        </span>
                      </p>
                      <span className="text-xs text-[#616f89] dark:text-gray-500 whitespace-nowrap">
                        09:30 AM
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 py-1 px-3 bg-orange-50/50 dark:bg-orange-900/10 rounded border border-orange-100 dark:border-orange-900/30">
                      <span className="material-symbols-outlined text-orange-500 text-sm">
                        calendar_month
                      </span>
                      <span className="text-xs font-medium text-orange-800 dark:text-orange-300">
                        Programada para: 05 de Noviembre, 2023 - 10:00 AM
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Pagination / Load More */}
            <div className="flex justify-center py-10">
              <button className="flex items-center gap-2 text-primary font-bold text-sm hover:bg-primary/5 px-6 py-2 rounded-full transition-colors border border-primary/20">
                <span className="material-symbols-outlined">history</span>
                Cargar actividad anterior
              </button>
            </div>
          </div>
        </main>
        {/* Footer for Desktop */}
        <footer className="border-t border-[#dbdfe6] dark:border-gray-800 bg-white dark:bg-background-dark py-8 px-10">
          <div className="max-w-[960px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-sm">
                verified_user
              </span>
              <span className="text-xs">
                Registro de auditoría inalterable conforme a normativa legal
                v2.4
              </span>
            </div>
            <div className="flex gap-6">
              <a
                className="text-xs text-gray-500 hover:text-primary cursor-pointer"
              >
                Términos de Servicio
              </a>
              <a
                className="text-xs text-gray-500 hover:text-primary cursor-pointer"
              >
                Privacidad de Datos
              </a>
              <a
                className="text-xs text-gray-500 hover:text-primary cursor-pointer"
              >
                Ayuda
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};