import React, { useState, useEffect, useCallback } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Menu,
  X,
  LogOut,
  Upload,
  ChevronLeft,
  CloudUpload,
  FileText,
  Info,
  AlertCircle,
  Loader2,
  Bell,
} from "lucide-react";
import { getNavGroups, navigationConfig } from "../lib/navigation";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import { documentsApi, backupsApi, notificationsApi, type ApiNotification } from "../lib/api";
import { useDocuments } from "../lib/useDocuments";
import { ModalFrame } from "./ui/index";
import { UserAvatar } from "./UserAvatar";
import { ToastProvider } from "../contexts/ToastContext";
import { ToastContainer } from "./ToastContainer";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { TeamAvatarRow } from "./TeamAvatarRow";
import { AssignWithDeadlinePopup, type AssignDropPayload } from "./AssignWithDeadlinePopup";
import { DOC_DRAG_END_EVENT, DOC_DRAG_START_EVENT } from "../lib/docDrag";
import { AppBrand } from "./AppBrand";


/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface UploadModalState {
  open: boolean;
  files: File[];
  uploading: boolean;
  error: string | null;
  isDragOver: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════════════════════════════════════════ */

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: ReturnType<typeof useAuth>["user"];
  onLogout: () => void;
}

const navGroups = getNavGroups();

const Sidebar: React.FC<SidebarProps> = ({ open, onClose, user, onLogout }) => {
  const location = useLocation();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    
    if (isLeftSwipe && open) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`
          fixed top-0 left-0 z-50 h-full w-64 sm:w-60 flex flex-col
          bg-white dark:bg-slate-800/60
          border-r border-slate-200 dark:border-slate-700/60
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 h-[4rem] pt-safe pb-2 sm:pb-0 shrink-0 border-b border-slate-200 dark:border-slate-700/60">
          <NavLink
            to="/"
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <AppBrand size="sm" wordmark="always" />
          </NavLink>
          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group) => (
            <div key={group.group}>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.end
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.end}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-3 sm:px-2.5 sm:py-2 rounded-xl sm:rounded-lg text-base sm:text-sm font-medium transition-colors
                          ${
                            isActive
                              ? "bg-primary/10 text-primary dark:text-blue-400"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                          }
                        `}
                      >
                        <Icon
                          className={`w-[22px] h-[22px] sm:w-[18px] sm:h-[18px] shrink-0 ${
                            isActive
                              ? "text-primary dark:text-blue-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── User footer ──────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/60 px-3 py-3">
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <UserAvatar
              name={user?.name}
              avatarUrl={user?.avatarUrl}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {user?.name ?? "Usuario"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {getRoleLabel(user?.role)}
              </p>
            </div>
            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Top Bar
   ═══════════════════════════════════════════════════════════════════════════ */

export type EditorTopBarSlots = {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
};

export type AppLayoutOutletContext = {
  searchQuery: string;
  openUploadModal: (files?: File[]) => void;
  refreshDocuments: () => Promise<void>;
  /** Se incrementa tras subidas/refresh global para que páginas como /documentos vuelvan a cargar datos. */
  documentsInvalidateSeq: number;
  setEditorTopBar: (slots: EditorTopBarSlots | null) => void;
};

interface TopBarProps {
  onMenuClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchOpen: () => void;
  onUploadClick: () => void;
  isEditorRoute: boolean;
  editorTopBar: EditorTopBarSlots | null;
  unreadCount: number;
  onBellClick: () => void;
}


const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  searchQuery,
  onSearchChange,
  onSearchOpen,
  onUploadClick,
  isEditorRoute,
  editorTopBar,
  unreadCount,
  onBellClick,
}) => {

  const navigate = useNavigate();
  const location = useLocation();
  const handleEditorBack = () => {
    const fromPath = (location.state as { from?: string } | null)?.from;
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    navigate("/documentos");
  };

  return (
    <header id="app-top-bar" className="sticky top-0 z-30 min-h-[4rem] shrink-0 flex items-center gap-1 px-2 sm:gap-2 sm:px-4 bg-white dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60 pt-safe pb-2 sm:pb-0">
      {!isEditorRoute && (
        <button
          type="button"
          onClick={onMenuClick}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6 sm:w-5 sm:h-5" />
        </button>
      )}

      {!isEditorRoute && (
        <NavLink
          to="/"
          className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
          aria-label="Inicio"
        >
          <AppBrand size="sm" wordmark="never" />
        </NavLink>
      )}

      {isEditorRoute && editorTopBar != null ? (
        <>
          <button
            type="button"
            onClick={handleEditorBack}
            className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white sm:w-10"
            aria-label="Regresar"
          >
            <ChevronLeft className="size-6 sm:size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex h-10 w-9 shrink-0 items-center justify-center sm:w-10">{editorTopBar.left}</div>
            <div className="flex min-w-0 flex-1 justify-center overflow-x-auto overflow-y-hidden py-1 no-scrollbar">
              <div className="mx-auto flex w-max max-w-full justify-center">{editorTopBar.center}</div>
            </div>
            <div className="flex h-10 w-9 shrink-0 items-center justify-center sm:w-10">{editorTopBar.right}</div>
          </div>
        </>
      ) : (
        <div
          className={`flex-1 min-w-0 ${isEditorRoute ? 'max-w-none' : 'max-w-md ml-1 sm:ml-0'}`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-4 sm:h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar… (⌘K)"
              readOnly
              onClick={onSearchOpen}
              onFocus={onSearchOpen}
              value=""
              className="w-full h-10 sm:h-9 pl-9 pr-3 rounded-lg text-sm sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            />
          </div>

        </div>
      )}

      {!isEditorRoute && (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bell button */}
          <button
            type="button"
            onClick={onBellClick}
            className="relative w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-700 shadow-sm transition-colors"
            aria-label="Nuevo documento"
          >
            <Upload className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Nuevo documento</span>
          </button>
        </div>
      )}
    </header>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Upload Modal
   ═══════════════════════════════════════════════════════════════════════════ */

interface UploadModalProps {
  state: UploadModalState;
  onClose: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveFile: (index: number) => void;
  onUpload: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  state,
  onClose,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveFile,
  onUpload,
}) => (
  <ModalFrame
    open={state.open}
    onClose={onClose}
    title="Agregar Nuevo Documento"
    description="Seleccione los archivos que desea guardar en el sistema legal."
    icon={CloudUpload}
    size="lg"
    footer={
      <>
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          onClick={onClose}
          disabled={state.uploading}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg shadow-sm transition-all ${
            state.files.length > 0 && !state.uploading
              ? "hover:bg-blue-700"
              : "opacity-50 cursor-not-allowed"
          }`}
          disabled={state.files.length === 0 || state.uploading}
          onClick={onUpload}
        >
          {state.uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              Subir y Guardar
            </>
          )}
        </button>
      </>
    }
  >
    {/* Drop zone */}
    <label
      className={`group relative border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
        state.isDragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900 hover:border-primary/40 hover:bg-primary/5"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        accept=".doc,.docx,.pdf,.xls,.xlsx,image/*"
        className="absolute inset-0 opacity-0 cursor-pointer"
        type="file"
        multiple
        onChange={onFileChange}
      />
      <div
        className={`bg-primary/10 text-primary p-4 rounded-full mb-4 transition-transform ${
          state.isDragOver ? "scale-110" : "group-hover:scale-105"
        }`}
      >
        <CloudUpload className="w-8 h-8" />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white text-center">
        {state.isDragOver
          ? "Suelte los archivos aquí"
          : "Arrastre aquí su archivo o haga clic para buscar"}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
        Formatos permitidos: Word, PDF, Excel e Imágenes (máx. 50 MB)
      </p>
    </label>

    {/* File list */}
    {state.files.length > 0 && (
      <div className="mt-4 space-y-2">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
          {state.files.length} archivo
          {state.files.length > 1 ? "s" : ""} seleccionado
          {state.files.length > 1 ? "s" : ""}
        </h4>
        {state.files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60"
          >
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemoveFile(idx)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              disabled={state.uploading}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Error */}
    {state.error && (
      <div className="mt-4 flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800/60">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <p>{state.error}</p>
      </div>
    )}

    {/* Info tip */}
    <div className="mt-4 flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary text-sm border border-blue-200 dark:border-blue-800/60">
      <Info className="w-4 h-4 shrink-0" />
      <p>
        El documento se guardará de forma segura en el expediente
        correspondiente.
      </p>
    </div>
  </ModalFrame>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Bottom Nav (Mobile)
   ═══════════════════════════════════════════════════════════════════════════ */

const BottomNav: React.FC = () => {
  const location = useLocation();
  const mobileItems = navigationConfig.filter((item) => item.mobileVisible);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.end
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={`
                flex flex-col items-center justify-center w-full h-full space-y-1 relative
                ${
                  isActive
                    ? "text-primary dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }
              `}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />
              )}
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "fill-primary/20" : ""
                  }`}
                />
              </div>
              <span className="text-[10px] font-semibold truncate w-full text-center px-1">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AppLayout — Main shell component
   ═══════════════════════════════════════════════════════════════════════════ */

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [documentsInvalidateSeq, setDocumentsInvalidateSeq] = useState(0);
  const { refresh: refreshDocumentsHook } = useDocuments({ autoFetch: false });
  const refreshDocuments = useCallback(async () => {
    await refreshDocumentsHook();
    setDocumentsInvalidateSeq((n) => n + 1);
  }, [refreshDocumentsHook]);

  // ── Notificaciones ──────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 30 });
      const data: ApiNotification[] = (res as any).data ?? res;
      setNotifications(data);
      setUnreadCount(data.filter((n: ApiNotification) => !n.isRead).length);
    } catch {
      // silently ignore
    }
  }, []);

  // Initial load + polling cada 30s
  useEffect(() => {
    setNotifLoading(true);
    fetchNotifications().finally(() => setNotifLoading(false));
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  // Sidebar open state (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Drag-and-drop global de documentos a avatares ──
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [dragAssignPayload, setDragAssignPayload] = useState<AssignDropPayload | null>(null);

  useEffect(() => {
    const onStart = () => setIsDraggingDoc(true);
    const onEnd = () => setIsDraggingDoc(false);
    window.addEventListener(DOC_DRAG_START_EVENT, onStart);
    window.addEventListener(DOC_DRAG_END_EVENT, onEnd);
    window.addEventListener("dragend", onEnd);
    window.addEventListener("drop", onEnd);
    return () => {
      window.removeEventListener(DOC_DRAG_START_EVENT, onStart);
      window.removeEventListener(DOC_DRAG_END_EVENT, onEnd);
      window.removeEventListener("dragend", onEnd);
      window.removeEventListener("drop", onEnd);
    };
  }, []);

  // Detect editor routes — hide sidebar completely
  const isEditorRoute = location.pathname.includes("/documento/");

  // Close sidebar on route change (mobile) and scroll to top
  useEffect(() => {
    setSidebarOpen(false);
    
    // Scroll to top on route change
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — abrir búsqueda global
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
        return;
      }
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);


  /* ── Auto-download daily backup for admins ─────────────────────────── */
  useEffect(() => {
    if (user?.role === "admin") {
      const checkDailyBackup = async () => {
        try {
          const res = await backupsApi.latestDaily();
          if (res.available && res.backup) {
            const downloadedKey = `daily_backup_v2_${res.backup.id}`;
            if (!localStorage.getItem(downloadedKey)) {
              console.log(
                "[AppLayout] Iniciando descarga automática del respaldo diario..."
              );
              await backupsApi.download(res.backup.id, res.backup.name);
              localStorage.setItem(downloadedKey, "true");
            }
          }
        } catch (error) {
          console.error(
            "[AppLayout] Error verificando respaldo diario:",
            error
          );
        }
      };
      checkDailyBackup();
    }
  }, [user?.role]);

  /* ── Upload modal state & handlers ─────────────────────────────────── */
  const [modal, setModal] = useState<UploadModalState>({
    open: false,
    files: [],
    uploading: false,
    error: null,
    isDragOver: false,
  });

  const openUploadModal = useCallback((files?: File[]) => {
    setModal((prev) => ({
      ...prev,
      open: true,
      files: files ? [...prev.files, ...files] : prev.files,
    }));
  }, []);

  const closeUploadModal = useCallback(() => {
    setModal({
      open: false,
      files: [],
      uploading: false,
      error: null,
      isDragOver: false,
    });
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        setModal((prev) => ({
          ...prev,
          files: [...prev.files, ...files],
          error: null,
        }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModal((prev) => ({ ...prev, isDragOver: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModal((prev) => ({ ...prev, isDragOver: false }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setModal((prev) => ({
        ...prev,
        isDragOver: false,
        files: [...prev.files, ...files],
        error: null,
      }));
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setModal((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }, []);

  const handleUploadAndSave = useCallback(async () => {
    if (modal.files.length === 0) return;
    setModal((prev) => ({ ...prev, uploading: true, error: null }));
    try {
      let lastDoc: any = null;
      for (const file of modal.files) {
        lastDoc = await documentsApi.upload(file);
      }
      closeUploadModal();
      await refreshDocuments();
      if (modal.files.length === 1 && lastDoc?.id) {
        const t = lastDoc.type?.toUpperCase();
        const isExcel = t === "XLSX" || t === "XLS";
        navigate(isExcel ? `/documento/${lastDoc.id}/excel` : `/documento/${lastDoc.id}`, {
          state: { seededDocument: lastDoc },
        });
      }
    } catch (err: any) {
      setModal((prev) => ({
        ...prev,
        uploading: false,
        error: err.message ?? "Error al subir el archivo",
      }));
    }
  }, [modal.files, closeUploadModal, refreshDocuments, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const [editorTopBar, setEditorTopBar] = useState<EditorTopBarSlots | null>(null);

  useEffect(() => {
    if (!isEditorRoute) setEditorTopBar(null);
  }, [isEditorRoute]);

  // Close notif drawer on route change
  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname]);

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden">
        {/* Sidebar — hidden on editor routes */}
        {!isEditorRoute && (
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            user={user}
            onLogout={handleLogout}
          />
        )}

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchOpen={() => setSearchModalOpen(true)}
            onUploadClick={() => openUploadModal()}
            isEditorRoute={isEditorRoute}
            editorTopBar={editorTopBar}
            unreadCount={unreadCount}
            onBellClick={() => setNotifOpen((prev) => !prev)}
          />


          {/* Content area */}
          <main id="main-content" className="flex-1 overflow-y-auto pb-24 lg:pb-0">
            <Outlet
              context={
                {
                  searchQuery,
                  openUploadModal,
                  refreshDocuments,
                  documentsInvalidateSeq,
                  setEditorTopBar,
                } satisfies AppLayoutOutletContext
              }
            />
          </main>
        </div>

        {/* Bottom Navigation (Mobile only) */}
        {!isEditorRoute && <BottomNav />}

        {/* Upload modal */}
        <UploadModal
          state={modal}
          onClose={closeUploadModal}
          onFileChange={handleFileChange}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onRemoveFile={handleRemoveFile}
          onUpload={handleUploadAndSave}
        />

        {/* Global Search Modal */}
        <GlobalSearchModal
          open={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
        />


        {/* Notifications Drawer */}
        <NotificationsDrawer
          open={notifOpen}
          notifications={notifications}
          loading={notifLoading}
          unreadCount={unreadCount}
          onClose={() => setNotifOpen(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />

        {/* Drag-and-drop overlay: floating team avatar bar */}
        {!isEditorRoute && (
          <div
            className={[
              "fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none",
              "transition-all duration-300 ease-in-out",
              isDraggingDoc ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
            ].join(" ")}
          >
            <div className="pointer-events-auto w-full max-w-[1200px] px-4 sm:px-6 pb-4 lg:pl-[calc(240px+1.5rem)]">
              <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-600/60 p-3">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 px-1">
                  Suelta sobre un miembro para asignar
                </p>
                <TeamAvatarRow
                  compact
                  onAssignDrop={(payload) => {
                    setIsDraggingDoc(false);
                    setDragAssignPayload(payload);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {dragAssignPayload && (
          <AssignWithDeadlinePopup
            payload={dragAssignPayload}
            onClose={() => setDragAssignPayload(null)}
            onSuccess={() => {
              setDragAssignPayload(null);
              void refreshDocuments();
            }}
          />
        )}

        {/* Toast container */}
        <ToastContainer />
      </div>
    </ToastProvider>
  );
};
