import React from "react";
import { ViewState } from "../types";

interface AppHeaderProps {
  onNavigate: (view: ViewState) => void;
  currentView: ViewState;
  onUploadClick?: () => void;
  deletedCount?: number;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onNavigate,
  currentView,
  onUploadClick,
  deletedCount = 0,
  searchQuery = "",
  onSearchChange,
}) => {
  const navClass = (view: ViewState) =>
    view === currentView
      ? "px-3 py-2 text-sm font-bold text-primary bg-primary/10 rounded-lg"
      : "px-3 py-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors";

  return (
    <header className="h-16 flex items-center px-4 md:px-8 bg-white dark:bg-[#1a212f] border-b border-[#dbdfe6] dark:border-[#2d3748] sticky top-0 z-50">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className="flex items-center gap-2 mr-6 cursor-pointer shrink-0"
          onClick={() => onNavigate(ViewState.DASHBOARD)}
        >
          <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">balance</span>
          </div>
          <h1 className="text-[#111318] dark:text-white text-lg font-bold leading-none hidden md:block">
            AbogadoSoft
          </h1>
        </div>

        <div className="hidden md:block flex-1 min-w-0 overflow-hidden">
          <nav className="flex items-center gap-1 overflow-x-auto overflow-y-hidden h-9 -mx-1 px-1 [scrollbar-gutter:stable]">
            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <button
            onClick={() => onNavigate(ViewState.DASHBOARD)}
            className={navClass(ViewState.DASHBOARD)}
          >
            Inicio
          </button>
          <button
            onClick={() => onNavigate(ViewState.DOCUMENTS)}
            className={navClass(ViewState.DOCUMENTS)}
          >
            Documentos
          </button>
          <button
            onClick={() => onNavigate(ViewState.ASIGNED)}
            className={navClass(ViewState.ASIGNED)}
          >
            Asignados
          </button>
          <button
            onClick={() => onNavigate(ViewState.AGREEMENTS)}
            className={navClass(ViewState.AGREEMENTS)}
          >
            Convenios
          </button>
          <button
            onClick={() => onNavigate(ViewState.ACTIVITY_LOG)}
            className={navClass(ViewState.ACTIVITY_LOG)}
          >
            Bitácora
          </button>
          <button
            onClick={() => onNavigate(ViewState.SECURITY)}
            className={navClass(ViewState.SECURITY)}
          >
            Seguridad
          </button>
          <button
            onClick={() => onNavigate(ViewState.TRASH)}
            className={`${navClass(ViewState.TRASH)} relative flex items-center gap-1.5`}
            aria-label={deletedCount > 0 ? `Papelera (${deletedCount} documento${deletedCount !== 1 ? "s" : ""})` : "Papelera"}
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Papelera
            {deletedCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-black">
                {deletedCount > 99 ? "99+" : deletedCount}
              </span>
            )}
          </button>
            </div>
          </nav>
        </div>

        <div className="relative w-full min-w-[10rem] max-w-[12rem] hidden sm:block shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#616f89]">
            search
          </span>
          <input
            className="w-full h-9 pl-10 pr-4 bg-background-light dark:bg-[#101622] border-none rounded-lg focus:ring-2 focus:ring-primary text-sm placeholder:text-[#616f89]"
            placeholder="Buscar..."
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label="Buscar documentos"
          />
        </div>
      </div>

      <div className="w-2 shrink-0" aria-hidden />

      <div className="flex items-center gap-4 shrink-0">
        {onUploadClick && (
          <>
            <button
              onClick={onUploadClick}
              className="flex items-center gap-2 h-9 px-3 bg-background-light dark:bg-gray-800 rounded-lg text-[#111318] dark:text-white text-sm font-semibold border border-[#dbdfe6] dark:border-[#2d3748] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              <span className="hidden sm:inline">Subir</span>
            </button>
            <div className="h-8 w-[1px] bg-[#dbdfe6] dark:bg-[#2d3748] mx-2 hidden sm:block"></div>
          </>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold leading-none">Lic. García</p>
            <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">Socio Principal</p>
          </div>
          <div
            className="size-10 rounded-full bg-cover bg-center border-2 border-white dark:border-[#2d3748] shadow-sm"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBSEfFZcc_w3SK5PnsmL4V30yNO8DpfFSCE3e9TlZGhdLVKq2pXoIg2G4L9Aw8pWUrPdcc3my5bSeGAVfXn9hdQYTdo1yEOR8kk302aNv10W1OyNWq8gtNrsiJYB09GxaAjG349kRgcX6XBV3UukeJ8d5-0-fgRjPQyXWnLxDNjQm18FMJrBQIFxEeoB5kgucZrfcstA9N5utnSBvsvdxS2k8vQMqxYR1dMxbCznoBfWTs0Ip__onKXnjGz7lPaqY5OjalPIrHhQhM")',
            }}
          />
        </div>
      </div>
    </header>
  );
};
