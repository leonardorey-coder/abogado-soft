import React, { useState, useEffect, useRef } from "react";
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navClass = (view: ViewState) =>
    view === currentView
      ? "px-3.5 py-2 text-sm font-bold text-primary bg-primary/10 rounded-xl transition-colors"
      : "px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors";

  const dropdownItemClass = (view: ViewState) =>
    view === currentView
      ? "w-full text-left px-4 py-2.5 text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between"
      : "w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between";

  const handleNavAndClose = (view: ViewState) => {
    onNavigate(view);
    setShowMoreMenu(false);
  };

  const moreItemsActive = [ViewState.ASIGNED, ViewState.ACTIVITY_LOG, ViewState.SECURITY, ViewState.TRASH].includes(currentView);

  return (
    <header className="h-[72px] flex items-center justify-between px-6 bg-white/80 dark:bg-[#1a212f]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-all">
      {/* Lado Izquierdo: Logo y Navegación Principal */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div
          className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
          onClick={() => onNavigate(ViewState.DASHBOARD)}
        >
          <div className="bg-primary w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
            <span className="material-symbols-outlined text-[20px]">balance</span>
          </div>
          <h1 className="text-slate-900 dark:text-white text-xl font-black tracking-tight hidden md:block">
            AbogadoSoft
          </h1>
        </div>

        <nav className="hidden lg:flex items-center gap-1.5 relative">
          <button onClick={() => onNavigate(ViewState.DASHBOARD)} className={navClass(ViewState.DASHBOARD)}>
            Inicio
          </button>
          <button onClick={() => onNavigate(ViewState.DOCUMENTS)} className={navClass(ViewState.DOCUMENTS)}>
            Documentos
          </button>
          <button onClick={() => onNavigate(ViewState.AGREEMENTS)} className={navClass(ViewState.AGREEMENTS)}>
            Convenios
          </button>
          <button onClick={() => onNavigate(ViewState.TEAM)} className={navClass(ViewState.TEAM)}>
            Equipo
          </button>

          {/* Buscador Integrado (Solo en pantallas extra grandes si se quiere, o lo dejamos a la derecha) */}

          {/* Menú Más */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex items-center gap-1 px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors ${moreItemsActive || showMoreMenu
                ? "text-primary bg-primary/10"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              Más <span className={`material-symbols-outlined text-[18px] transition-transform ${showMoreMenu ? "rotate-180" : ""}`}>expand_more</span>
            </button>
            {showMoreMenu && (
              <div className="absolute left-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 overflow-hidden">
                <button onClick={() => handleNavAndClose(ViewState.ASIGNED)} className={dropdownItemClass(ViewState.ASIGNED)}>
                  <span>Asignados</span>
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                <button onClick={() => handleNavAndClose(ViewState.ACTIVITY_LOG)} className={dropdownItemClass(ViewState.ACTIVITY_LOG)}>
                  <span>Bitácora</span>
                </button>
                <button onClick={() => handleNavAndClose(ViewState.SECURITY)} className={dropdownItemClass(ViewState.SECURITY)}>
                  <span>Seguridad</span>
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                <button onClick={() => handleNavAndClose(ViewState.TRASH)} className={`${dropdownItemClass(ViewState.TRASH)} ${currentView !== ViewState.TRASH ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    <span>Papelera</span>
                  </div>
                  {deletedCount > 0 && (
                    <span className="flex-shrink-0 min-w-[20px] h-[20px] flex items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-black">
                      {deletedCount > 99 ? "99+" : deletedCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Lado Derecho: Buscador, Acciones y Usuario */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative w-full max-w-[240px] hidden md:block shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
            search
          </span>
          <input
            className="w-full h-10 pl-10 pr-4 bg-slate-100/80 dark:bg-slate-800/80 border border-transparent rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-500 transition-all font-medium text-slate-900 dark:text-white"
            placeholder="Buscar..."
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label="Buscar"
          />
        </div>

        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 h-10 px-4 bg-primary text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        )}

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" aria-hidden />

        <div className="flex items-center gap-3 relative" ref={userMenuRef}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{getRoleLabel(user?.role)}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-[2px] border-white dark:border-slate-700 shadow-sm overflow-hidden focus:ring-2 focus:ring-primary focus:outline-none transition-transform hover:scale-105 active:scale-95"
            aria-label="Menú de usuario"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-white font-black text-lg">
                {(user?.name ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 min-w-[220px] transform-gpu">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
              {/* Mobile Navigation fallback (visible only on small screens inside user menu) */}
              <div className="lg:hidden">
                <div className="px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-widest">Navegación</div>
                <button onClick={() => handleNavAndClose(ViewState.DASHBOARD)} className={dropdownItemClass(ViewState.DASHBOARD)}>Inicio</button>
                <button onClick={() => handleNavAndClose(ViewState.DOCUMENTS)} className={dropdownItemClass(ViewState.DOCUMENTS)}>Documentos</button>
                <button onClick={() => handleNavAndClose(ViewState.AGREEMENTS)} className={dropdownItemClass(ViewState.AGREEMENTS)}>Convenios</button>
                <button onClick={() => handleNavAndClose(ViewState.TEAM)} className={dropdownItemClass(ViewState.TEAM)}>Equipo</button>
                <button onClick={() => handleNavAndClose(ViewState.ASIGNED)} className={dropdownItemClass(ViewState.ASIGNED)}>Asignados</button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
              </div>
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                  onNavigate(ViewState.LOGIN);
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
