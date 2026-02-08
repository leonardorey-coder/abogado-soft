import React, { useState } from "react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";

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
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
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
        <div className="flex items-center gap-3 relative">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold leading-none">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">{getRoleLabel(user?.role)}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="size-10 rounded-full bg-cover bg-center border-2 border-white dark:border-[#2d3748] shadow-sm overflow-hidden focus:ring-2 focus:ring-primary"
            aria-label="Menú de usuario"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                {(user?.name ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-2 min-w-[180px]">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                    onNavigate(ViewState.LOGIN);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
