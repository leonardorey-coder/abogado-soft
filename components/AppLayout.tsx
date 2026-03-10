import React, { useState, useEffect, useCallback } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Scale,
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
} from "lucide-react";
import { getNavGroups } from "../lib/navigation";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import { documentsApi, backupsApi } from "../lib/api";
import { useDocuments } from "../lib/useDocuments";
import { ModalFrame } from "./ui/index";

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

function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
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
        className={`
          fixed top-0 left-0 z-50 h-full w-60 flex flex-col
          bg-white dark:bg-slate-800/60
          border-r border-slate-200 dark:border-slate-700/60
          transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-5 h-14 shrink-0 border-b border-slate-200 dark:border-slate-700/60">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Scale className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            AbogadoSoft
          </span>
          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
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
                          flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors
                          ${
                            isActive
                              ? "bg-primary/10 text-primary dark:text-blue-400"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                          }
                        `}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 ${
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
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {getUserInitials(user?.name)}
              </div>
            )}
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
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
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

interface TopBarProps {
  onMenuClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onUploadClick: () => void;
  isEditorRoute: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  searchQuery,
  onSearchChange,
  onUploadClick,
  isEditorRoute,
}) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 flex items-center gap-3 px-4 bg-white dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60">
      {/* Left: hamburger (mobile) or back button (editor) */}
      {isEditorRoute ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
          aria-label="Regresar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onMenuClick}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar documentos…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo documento</span>
        </button>
      </div>
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
   AppLayout — Main shell component
   ═══════════════════════════════════════════════════════════════════════════ */

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { refresh: refreshDocuments } = useDocuments({ autoFetch: false });

  // Sidebar open state (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Detect editor routes — hide sidebar completely
  const isEditorRoute = location.pathname.includes("/documento/");

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        const isExcel =
          lastDoc.type?.toUpperCase() === "XLSX" ||
          lastDoc.type?.toUpperCase() === "XLS";
        navigate(
          isExcel
            ? `/documento/${lastDoc.id}/excel`
            : `/documento/${lastDoc.id}`
        );
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

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
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
          onUploadClick={() => openUploadModal()}
          isEditorRoute={isEditorRoute}
        />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ searchQuery, openUploadModal, refreshDocuments }} />
        </main>
      </div>

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
    </div>
  );
};
