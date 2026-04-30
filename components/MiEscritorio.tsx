import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Cloud,
  DownloadCloud,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Monitor,
  Plus,
  Settings,
  ShieldCheck,
  Table,
  Trash2,
} from "lucide-react";
import type { Document, CollaborationStatus, DocumentPermissionLevel, FileStatus, SharingStatus } from "../types";
import { canChangeDocumentFileStatus } from "../lib/documentPermissions";
import { FileStatusIconToggle } from "./FileStatusIconToggle";
import type { ApiDocumentAssignment } from "../lib/api";
import { assignmentsApi, documentsApi, getShareableDocumentFile } from "../lib/api";
import { startDocDrag, endDocDrag } from "../lib/docDrag";
import { apiDocToFrontend, useDocuments } from "../lib/useDocuments";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getDocumentRoute } from "../lib/routes";
import { buildDocumentActionMenuItems } from "../lib/documentActionMenu";
import {
  getFolderNameFromPath,
  readLocalWorkspace,
  removeLocalFolder,
  upsertLocalFolder,
  writeLocalWorkspace,
  type LocalWorkspaceFolder,
  type LocalWorkspaceState,
} from "../lib/localWorkspace";
import { AssignModal } from "./AssignModal";
import { DashboardCalendar } from "./DashboardCalendar";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { ShareModal } from "./ShareModal";
import {
  ActionMenu,
  Button,
  EmptyState,
  SectionCard,
  Skeleton,
  type ActionMenuItem,
} from "./ui";

type SelectFilter = "TODOS" | string;
type LocalSyncStatus = "pending" | "syncing" | "synced" | "error";

interface LocalFileRecord extends ElectronLocalFile {
  document?: Document;
  syncStatus: LocalSyncStatus;
  syncError?: string;
}

interface LocalSyncEntry {
  document: Document;
  size: number;
  mtimeMs: number;
}

type LocalSyncMap = Record<string, LocalSyncEntry>;

interface KnownFolder {
  key: keyof ElectronKnownFolders;
  label: string;
}

const KNOWN_FOLDERS: KnownFolder[] = [
  { key: "desktop", label: "Escritorio" },
  { key: "documents", label: "Documentos" },
  { key: "downloads", label: "Descargas" },
];

const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  ACTIVO: "Activo",
  PENDIENTE: "Pendiente",
  INACTIVO: "Inactivo",
};

const FILE_STATUS_TAB_CLASSES: Record<FileStatus, string> = {
  ACTIVO:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
  PENDIENTE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  INACTIVO:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const COLLABORATION_LABELS: Record<CollaborationStatus, string> = {
  VISTO: "Visto",
  EDITADO: "Editado",
  COMENTADO: "Comentado",
  REVISADO: "Revisado",
  APROBADO: "Aprobado",
  PENDIENTE_REVISION: "Pendiente revisión",
  RECHAZADO: "Rechazado",
};

const SHARING_LABELS: Record<SharingStatus, string> = {
  ENVIADO: "Enviado",
  ASIGNADO: "Asignado",
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  visto: "Visto",
  editado: "Editado",
  revisado: "Revisado",
  completado: "Completado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

const LOCAL_SYNC_KEY = "abogadosoft.localWorkspace.sync.v1";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const SYNC_BATCH_SIZE = 3;
const SYNC_BATCH_DELAY_MS = 900;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate(value?: string | null) {
  if (!value) return "Sin registro";
  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "documento";
}

function readLocalSyncMap(): LocalSyncMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_SYNC_KEY) || "{}") as LocalSyncMap;
  } catch {
    return {};
  }
}

function writeLocalSyncMap(map: LocalSyncMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_SYNC_KEY, JSON.stringify(map));
}

function getLocalFileType(file: Pick<ElectronLocalFile, "ext">): Document["type"] {
  const ext = file.ext.toLowerCase();
  if (ext === "xlsx" || ext === "xls") return "XLSX";
  if (ext === "pdf") return "PDF";
  return "DOCX";
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAssignmentStatus(doc: Document, assignmentByDoc: Map<string, ApiDocumentAssignment>) {
  return assignmentByDoc.get(doc.id)?.status ?? doc.assignments?.[0]?.status ?? null;
}

function getPrimaryTab(doc: Document, assignmentStatus: string | null) {
  if (assignmentStatus) return ASSIGNMENT_LABELS[assignmentStatus] ?? assignmentStatus;
  if (doc.collaborationStatus) return COLLABORATION_LABELS[doc.collaborationStatus] ?? doc.collaborationStatus;
  if (doc.sharingStatus) return SHARING_LABELS[doc.sharingStatus] ?? doc.sharingStatus;
  return FILE_STATUS_LABELS[doc.fileStatus] ?? doc.fileStatus;
}

function getTabClasses(doc: Document, assignmentStatus: string | null) {
  const key = (assignmentStatus ?? doc.collaborationStatus ?? doc.sharingStatus ?? doc.fileStatus ?? "").toLowerCase();
  if (["activo", "visto", "revisado", "aprobado", "completado"].includes(key)) {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
  if (["pendiente", "editado", "comentado", "pendiente_revision", "asignado", "enviado"].includes(key)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (["rechazado", "cancelado", "inactivo"].includes(key)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300";
  }
  return "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function getDocIcon(type: Document["type"]) {
  if (type === "XLSX") return Table;
  return FileText;
}

function isCloudBacked(doc: Document) {
  return Boolean(doc.storageKey || doc.driveFileId || doc.syncStatus === "completed" || doc.lastSyncAt);
}

async function getLocalFilePath(folder: LocalWorkspaceFolder, doc: Document) {
  const api = window.electronAPI;
  if (!api) throw new Error("La apertura local requiere la app de escritorio.");
  return api.pathJoin(folder.path, normalizeName(doc.name));
}

function FolderSettings({
  open,
  workspace,
  onAddPath,
  onRemove,
  onSetActive,
  onClose,
  onUnavailable,
}: {
  open: boolean;
  workspace: LocalWorkspaceState;
  onAddPath: (path: string, name?: string) => void;
  onRemove: (id: string) => void;
  onSetActive: (id: string) => void;
  onClose: () => void;
  onUnavailable: (message: string) => void;
}) {
  const [knownFolders, setKnownFolders] = useState<ElectronKnownFolders | null>(null);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const api = window.electronAPI;

  useEffect(() => {
    if (!api?.getKnownFolders) return;
    api.getKnownFolders().then(setKnownFolders).catch(() => setKnownFolders(null));
  }, [api]);

  const selectFolder = async () => {
    if (!api?.selectFolder) {
      onUnavailable("Para seleccionar carpetas locales abre la app con bun run electron:full.");
      return;
    }

    try {
      setSelectingFolder(true);
      const path = await api.selectFolder();
      if (path) onAddPath(path);
    } catch (err) {
      onUnavailable(err instanceof Error ? err.message : "No se pudo abrir el selector de carpeta.");
    } finally {
      setSelectingFolder(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Carpetas locales</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Elige dónde guardar y abrir copias locales.</p>
        </div>
        <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="space-y-3">
        {!api?.isElectron && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            La selección y apertura nativa de carpetas está disponible en la app de escritorio.
          </div>
        )}

        {knownFolders && (
          <div className="flex flex-wrap gap-2">
            {KNOWN_FOLDERS.map((folder) => (
              <Button
                key={folder.key}
                type="button"
                size="sm"
                variant="secondary"
                icon={FolderOpen}
                onClick={() => onAddPath(knownFolders[folder.key], folder.label)}
              >
                Usar {folder.label}
              </Button>
            ))}
          </div>
        )}

        <Button type="button" size="sm" variant="secondary" icon={Plus} loading={selectingFolder} onClick={selectFolder}>
          Agregar otra carpeta
        </Button>

        {workspace.folders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No hay carpetas configuradas.
          </div>
        ) : (
          <div className="grid gap-2">
            {workspace.folders.map((folder) => {
              const active = workspace.activeFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-primary bg-blue-50/70 dark:bg-blue-900/20"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60"
                  }`}
                >
                  <button type="button" className="block w-full text-left" onClick={() => onSetActive(folder.id)}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      {folder.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400" title={folder.path}>
                      {folder.path}
                    </span>
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    {active ? (
                      <span className="text-xs font-semibold text-primary">Activa</span>
                    ) : (
                      <button type="button" className="text-xs font-semibold text-primary" onClick={() => onSetActive(folder.id)}>
                        Activar
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700"
                      aria-label={`Quitar ${folder.name}`}
                      onClick={() => onRemove(folder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderSlider({
  folders,
  activeFolderId,
  onChange,
}: {
  folders: LocalWorkspaceFolder[];
  activeFolderId: string | null;
  onChange: (id: string) => void;
}) {
  if (folders.length === 0) {
    return (
      <div className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <span className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-300">
          Sin carpeta local
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {folders.map((folder) => {
        const active = activeFolderId === folder.id;
        return (
          <button
            key={folder.id}
            type="button"
            onClick={() => onChange(folder.id)}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {folder.name}
          </button>
        );
      })}
    </div>
  );
}

function CompactFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[11rem] flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function DocumentThumbnail({ doc }: { doc: Document }) {
  const ref = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string[][] | null>(null);
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let nextUrl: string | null = null;

    async function loadPreview() {
      try {
        setLoading(true);
        const file = await getShareableDocumentFile(doc.id, doc.name);
        if (cancelled) return;

        if (file.size > MAX_PREVIEW_BYTES) {
          setFailed(true);
          return;
        }

        if (doc.type === "PDF") {
          nextUrl = URL.createObjectURL(file);
          setObjectUrl(nextUrl);
          return;
        }

        if (doc.type === "XLSX") {
          const XLSX = await import("xlsx");
          const buffer = await file.arrayBuffer();
          if (cancelled) return;
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }).slice(0, 8);
          setSheet(rows.map((row) => row.slice(0, 5).map((cell) => String(cell ?? ""))));
          return;
        }

        if (doc.type === "DOCX") {
          const content = await documentsApi.getContent(doc.id);
          if (cancelled) return;
          if (content.html?.trim()) {
            setDocHtml(content.html);
            return;
          }
        }

        if (docxRef.current) {
          const { renderAsync } = await import("docx-preview");
          await renderAsync(file, docxRef.current, undefined, {
            className: "mi-escritorio-docx-preview",
            inWrapper: false,
            ignoreWidth: true,
            ignoreHeight: true,
          });
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [doc.id, doc.name, doc.type, visible]);

  const Icon = getDocIcon(doc.type);

  return (
    <div ref={ref} className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="absolute left-2 top-2 z-10 flex gap-1">
        <span className="rounded-md border border-green-200 bg-green-50 p-1 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300" title={FILE_STATUS_LABELS[doc.fileStatus]}>
          <CheckCircle2 className="h-4 w-4" />
        </span>
        {doc.currentUserPermission && (
          <span className="rounded-md border border-slate-200 bg-white/95 p-1 text-slate-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300" title={`Permiso: ${doc.currentUserPermission}`}>
            <ShieldCheck className="h-4 w-4" />
          </span>
        )}
      </div>
      {!visible || loading ? <Skeleton className="h-full w-full rounded-none" /> : null}

      {visible && !loading && doc.type === "PDF" && objectUrl && (
        <iframe title={`Vista previa de ${doc.name}`} src={objectUrl} loading="lazy" className="h-full w-full bg-white" />
      )}

      {visible && !loading && doc.type === "XLSX" && sheet && (
        <div className="h-full w-full overflow-hidden bg-white p-2 text-[9px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
          <table className="w-full border-collapse">
            <tbody>
              {sheet.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: 5 }).map((_, cellIndex) => (
                    <td key={cellIndex} className="max-w-[4rem] truncate border border-slate-200 px-1 py-0.5 dark:border-slate-700">
                      {row[cellIndex]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible && !loading && doc.type === "DOCX" && (
        <div className="h-full w-full overflow-hidden bg-white dark:bg-slate-950">
          {docHtml ? (
            <div
              className="h-full w-full overflow-hidden p-5 text-[10px] leading-snug text-slate-900 [&_*]:max-w-full [&_p]:mb-1 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-1"
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />
          ) : (
            <div ref={docxRef} className="h-full w-full origin-top-left scale-[0.62] overflow-hidden p-5 text-slate-900" />
          )}
        </div>
      )}

      {failed && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
          <Icon className="h-8 w-8" />
          <span className="text-xs font-medium">Vista previa no disponible</span>
        </div>
      )}
    </div>
  );
}

const PREVIEW_PAPER_WIDTH = 816;

function LocalFileThumbnail({ file }: { file: LocalFileRecord }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [docxReady, setDocxReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    const target = wrapperRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const target = wrapperRef.current;
    if (!target) return;
    const update = () => {
      const w = target.clientWidth;
      if (w > 0) setScale(w / PREVIEW_PAPER_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setPdfUrl(null);
    setXlsxHtml(null);
    setTextPreview(null);
    setDocxReady(false);
    setUnsupported(false);
    setFailed(false);
    if (docxRef.current) docxRef.current.innerHTML = "";

    async function loadPreview() {
      try {
        if (file.size > MAX_PREVIEW_BYTES) {
          if (!cancelled) setUnsupported(true);
          return;
        }
        setLoading(true);
        const api = window.electronAPI;
        if (!api?.readFile) throw new Error("Lectura local requiere la app de escritorio.");
        const res = await api.readFile(file.path);
        if (!res.ok || !res.buffer) throw new Error(res.error ?? "No se pudo leer el archivo");
        if (cancelled) return;
        const blob = new Blob([res.buffer], { type: res.mimeType || file.mimeType });

        if (file.ext === "pdf") {
          createdUrl = URL.createObjectURL(blob);
          if (!cancelled) setPdfUrl(createdUrl);
          return;
        }

        if (file.ext === "xlsx" || file.ext === "xls") {
          const XLSX = await import("xlsx");
          const buffer = await blob.arrayBuffer();
          if (cancelled) return;
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!firstSheet) throw new Error("La hoja está vacía");
          const html = XLSX.utils.sheet_to_html(firstSheet, { editable: false });
          if (!cancelled) setXlsxHtml(html);
          return;
        }

        if (file.ext === "docx" || file.ext === "doc") {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          if (cancelled) return;
          if (!docxRef.current) {
            if (!cancelled) setFailed(true);
            return;
          }
          docxRef.current.innerHTML = "";
          const { renderAsync } = await import("docx-preview");
          await renderAsync(blob, docxRef.current, undefined, {
            className: "mi-escritorio-docx-preview",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: true,
            ignoreFonts: false,
            breakPages: false,
            useBase64URL: true,
            experimental: true,
          });
          if (!cancelled) setDocxReady(true);
          return;
        }

        if (file.ext === "txt" || file.ext === "rtf") {
          if (!cancelled) setTextPreview((await blob.text()).slice(0, 4000));
          return;
        }

        if (!cancelled) setUnsupported(true);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.path, file.ext, file.mimeType, file.size, file.mtimeMs, visible]);

  const Icon = getDocIcon(getLocalFileType(file));
  const isDocx = file.ext === "docx" || file.ext === "doc";
  const showSkeleton = !visible || loading;

  return (
    <div ref={wrapperRef} className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      {visible && file.ext === "pdf" && pdfUrl && (
        <iframe
          title={`Vista previa de ${file.name}`}
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          loading="lazy"
          className="absolute inset-0 h-full w-full bg-white"
        />
      )}

      {visible && isDocx && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white text-slate-900"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
        >
          <div ref={docxRef} className="mi-escritorio-docx-host" />
        </div>
      )}

      {visible && xlsxHtml && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white p-4 text-[12px] text-slate-900 [&_table]:w-auto [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: xlsxHtml }}
        />
      )}

      {visible && textPreview && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left whitespace-pre-wrap bg-white p-6 font-mono text-[12px] leading-tight text-slate-900"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
        >
          {textPreview}
        </div>
      )}

      {(failed || unsupported) && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 p-4 text-center text-slate-500 dark:bg-slate-950/95">
          <Icon className="h-8 w-8" />
          <span className="text-xs font-medium">
            {unsupported ? "Archivo demasiado grande para previsualizar" : "Vista previa no disponible"}
          </span>
        </div>
      )}

      {showSkeleton && !failed && !unsupported && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}

      {visible && !loading && isDocx && !docxReady && !failed && !unsupported && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
    </div>
  );
}

function TypeIconFilter({
  value,
  onChange,
  counts,
}: {
  value: SelectFilter;
  onChange: (value: SelectFilter) => void;
  counts: { TODOS: number; DOCX: number; XLSX: number; PDF: number };
}) {
  function OfficeTypeIcon({ type }: { type: "DOCX" | "XLSX" | "PDF" }) {
    const iconMap = {
      DOCX: {
        letter: "W",
        left: "fill-[#185ABD]",
      },
      XLSX: {
        letter: "X",
        left: "fill-[#107C41]",
      },
      PDF: {
        letter: "PDF",
        left: "fill-[#B30B00]",
      },
    } as const;
    const icon = iconMap[type];
    const letterSize = type === "PDF" ? "text-[5px]" : "text-[9px]";
    return (
      <span className="inline-flex h-5 w-[18px] items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-5 w-[18px]" aria-hidden="true">
          <rect x="2" y="3" width="20" height="18" rx="3" className={icon.left} />
          <text
            x="12"
            y="12.5"
            textAnchor="middle"
            dominantBaseline="middle"
            className={`fill-white font-black tracking-tight ${letterSize}`}
          >
            {icon.letter}
          </text>
        </svg>
      </span>
    );
  }

  const items: Array<{
    index: number;
    value: SelectFilter;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    { index: 0, value: "TODOS", label: "Todos", icon: <Layers className="h-4 w-4" />, activeClass: "text-slate-900 dark:text-white" },
    { index: 1, value: "DOCX", label: "Word", icon: <OfficeTypeIcon type="DOCX" />, activeClass: "text-blue-700 dark:text-blue-200" },
    { index: 2, value: "XLSX", label: "Excel", icon: <OfficeTypeIcon type="XLSX" />, activeClass: "text-emerald-700 dark:text-emerald-200" },
    { index: 3, value: "PDF", label: "PDF", icon: <OfficeTypeIcon type="PDF" />, activeClass: "text-red-700 dark:text-red-200" },
  ];
  const selectedIndex = Math.max(items.findIndex((item) => item.value === value), 0);

  return (
    <div className="flex min-w-[11rem] flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tipo</span>
      <div className="relative inline-flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        <div
          className="pointer-events-none absolute bottom-1 top-1 w-10 rounded-lg bg-slate-100 shadow-sm transition-transform duration-300 ease-out dark:bg-slate-700/80"
          style={{ transform: `translateX(${selectedIndex * 2.75}rem)` }}
        />
        {items.map((item) => {
          const active = value === item.value;
          const count = counts[item.value as keyof typeof counts] ?? 0;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              title={`${item.label} (${count})`}
              aria-label={`${item.label} (${count})`}
              className={`relative z-[1] flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg transition-colors ${
                active ? item.activeClass : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {item.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocalFileCard({
  file,
  onOpen,
  onOpenLocal,
  onShare,
  onAssign,
  onPermissions,
  onDocumentFileStatusChange,
  onDeleteDocument,
  confirmDeleteDocId,
  confirmDeleteSecondsLeft,
  onActionMenuClose,
}: {
  file: LocalFileRecord;
  onOpen: () => void;
  onOpenLocal: () => void;
  onShare: () => void;
  onAssign: () => void;
  onPermissions: () => void;
  onDocumentFileStatusChange?: (filePath: string, doc: Document, status: FileStatus) => void | Promise<void>;
  onDeleteDocument: (doc: Document) => void;
  confirmDeleteDocId: string | null;
  confirmDeleteSecondsLeft: number;
  onActionMenuClose: () => void;
}) {
  const { user } = useAuth();
  const isSynced = file.syncStatus === "synced";

  const menuItems = React.useMemo((): ActionMenuItem[] => {
    const localRow: ActionMenuItem[] = [
      { label: "Abrir en aplicación local", icon: ExternalLink, onClick: onOpenLocal },
    ];
    if (!file.document) return localRow;
    const d = file.document;
    const permissionLevel: DocumentPermissionLevel | undefined =
      d.ownerId && user?.id && d.ownerId === user.id ? "admin" : undefined;
    return [
      ...localRow,
      ...buildDocumentActionMenuItems(d, {
        onOpen,
        onShare,
        onAssign,
        onPermissions,
        onDelete: () => onDeleteDocument(d),
        confirmDeleteDocId,
        confirmDeleteSecondsLeft,
        permissionLevel,
      }),
    ];
  }, [
    file.document,
    user?.id,
    onOpen,
    onOpenLocal,
    onShare,
    onAssign,
    onPermissions,
    onDeleteDocument,
    confirmDeleteDocId,
    confirmDeleteSecondsLeft,
  ]);

  return (
    <article
      className="group relative mt-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 pt-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      draggable={!!file.document}
      onDragStart={(event) => {
        if (!file.document) return;
        startDocDrag(event, {
          id: file.document.id,
          name: file.document.name ?? file.name,
          type: (file.document as any).type ?? file.ext.toUpperCase(),
        });
      }}
      onDragEnd={() => endDocDrag()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {file.document && (
        <div className="absolute left-4 top-0 z-10 -translate-y-full">
          <span
            className={`rounded-t-lg border border-b-0 px-3 py-1 text-xs font-semibold ${
              FILE_STATUS_TAB_CLASSES[file.document.fileStatus ?? "ACTIVO"]
            }`}
            title={`Estado del documento: ${FILE_STATUS_LABELS[file.document.fileStatus ?? "ACTIVO"]}`}
          >
            {FILE_STATUS_LABELS[file.document.fileStatus ?? "ACTIVO"]}
          </span>
        </div>
      )}
      <div className="relative">
        {isSynced && (
          <div className="absolute right-2 top-2 z-10 rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300" title="Respaldado en la nube">
            <Cloud className="h-4 w-4" />
          </div>
        )}
        <div className="absolute left-2 top-2 z-10 rounded-md border border-green-200 bg-green-50 p-1 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300" title="Archivo local disponible">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <LocalFileThumbnail file={file} />
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary dark:text-white" title={file.name}>
          {file.name}
        </p>
        <div className="mt-1 grid gap-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Modificado: {formatDate(file.modifiedAt)}</span>
          <span>{formatFileSize(file.size)} · {file.ext.toUpperCase()}</span>
          {file.syncStatus === "error" && <span className="text-red-600">{file.syncError}</span>}
        </div>
        {file.document && onDocumentFileStatusChange && (
          <div className="mt-2">
            <FileStatusIconToggle
              value={file.document.fileStatus ?? "ACTIVO"}
              disabled={!canChangeDocumentFileStatus(file.document, user?.id)}
              onChange={(status) => void onDocumentFileStatusChange(file.path, file.document!, status)}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:text-slate-400 disabled:no-underline"
          onClick={(event) => {
            event.stopPropagation();
            onOpenLocal();
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir local
        </button>
        <div onClick={(event) => event.stopPropagation()}>
          <ActionMenu items={menuItems} onClose={onActionMenuClose} />
        </div>
      </div>
    </article>
  );
}

function FileCardSkeleton() {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 pt-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60">
      <Skeleton className="aspect-square rounded-md" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function MiEscritorio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [workspace, setWorkspace] = useState<LocalWorkspaceState>(() => readLocalWorkspace());
  const [fileStatus, setFileStatus] = useState<SelectFilter>("TODOS");
  const [syncStatusFilter, setSyncStatusFilter] = useState<SelectFilter>("TODOS");
  const [docStatusFilter, setDocStatusFilter] = useState<SelectFilter>("TODOS");
  const [collaborationStatus, setCollaborationStatus] = useState<SelectFilter>("TODOS");
  const [sharingStatusFilter, setSharingStatusFilter] = useState<SelectFilter>("TODOS");
  const [assignmentStatus, setAssignmentStatus] = useState<SelectFilter>("TODOS");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localFiles, setLocalFiles] = useState<LocalFileRecord[]>([]);
  const [localFilesLoading, setLocalFilesLoading] = useState(false);
  const [localFilesError, setLocalFilesError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ApiDocumentAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);
  const [permissionsDocument, setPermissionsDocument] = useState<Document | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteSecondsLeft, setConfirmDeleteSecondsLeft] = useState(0);
  const deleteConfirmTimerRef = useRef<number | null>(null);
  const syncRunRef = useRef(0);
  const {
    documents,
    loading,
    error,
    refresh,
    deleteDocument,
  } = useDocuments({ limit: 100 });

  useEffect(() => {
    writeLocalWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    return () => {
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadAssignments() {
      try {
        setAssignmentsLoading(true);
        const res = await assignmentsApi.listReceived({ limit: 100 });
        if (mounted) setAssignments(res.data);
      } catch {
        if (mounted) setAssignments([]);
      } finally {
        if (mounted) setAssignmentsLoading(false);
      }
    }
    loadAssignments();
    return () => { mounted = false; };
  }, []);

  const activeFolder = workspace.folders.find((folder) => folder.id === workspace.activeFolderId) ?? null;

  const syncLocalFile = React.useCallback(async (file: ElectronLocalFile): Promise<boolean> => {
    const api = window.electronAPI;
    if (!api?.readFile) return false;

    if (file.size > MAX_UPLOAD_BYTES) {
      const message = `Archivo mayor a ${formatFileSize(MAX_UPLOAD_BYTES)}. Súbelo manualmente o usa un flujo de carga grande.`;
      setLocalFiles((prev) => prev.map((item) => item.path === file.path ? { ...item, syncStatus: "error", syncError: message } : item));
      return false;
    }

    setLocalFiles((prev) => prev.map((item) => item.path === file.path ? { ...item, syncStatus: "syncing", syncError: undefined } : item));
    try {
      const res = await api.readFile(file.path);
      if (!res.ok || !res.buffer) throw new Error(res.error ?? "No se pudo leer el archivo local");
      const uploaded = await documentsApi.upload(
        new File([res.buffer], file.name, { type: res.mimeType || file.mimeType }),
        { name: file.name, description: `Importado desde ${activeFolder?.name ?? "Mi escritorio"}` },
      );
      const document = apiDocToFrontend(uploaded);
      const syncMap = readLocalSyncMap();
      syncMap[file.path] = { document, size: file.size, mtimeMs: file.mtimeMs };
      writeLocalSyncMap(syncMap);
      setLocalFiles((prev) => prev.map((item) => item.path === file.path ? { ...item, document, syncStatus: "synced" } : item));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir a la nube";
      setLocalFiles((prev) => prev.map((item) => item.path === file.path ? { ...item, syncStatus: "error", syncError: message } : item));
      return false;
    }
  }, [activeFolder?.name]);

  const syncPendingFilesGradually = React.useCallback(async (files: ElectronLocalFile[], runId: number) => {
    let syncedAny = false;
    for (let index = 0; index < files.length; index += 1) {
      if (syncRunRef.current !== runId) return;
      const ok = await syncLocalFile(files[index]);
      syncedAny = syncedAny || ok;
      if ((index + 1) % SYNC_BATCH_SIZE === 0) {
        await delay(SYNC_BATCH_DELAY_MS);
      }
    }
    if (syncedAny && syncRunRef.current === runId) {
      await refresh();
    }
  }, [refresh, syncLocalFile]);

  const scanActiveFolder = React.useCallback(async () => {
    if (!activeFolder) {
      setLocalFiles([]);
      return;
    }

    const api = window.electronAPI;
    if (!api?.listFolderFiles) {
      setLocalFilesError("Abre la app con bun run electron:full para leer carpetas locales.");
      return;
    }

    try {
      setLocalFilesLoading(true);
      setLocalFilesError(null);
      const runId = syncRunRef.current + 1;
      syncRunRef.current = runId;
      const res = await api.listFolderFiles(activeFolder.path);
      if (!res.ok) throw new Error(res.error ?? "No se pudo leer la carpeta");
      const syncMap = readLocalSyncMap();
      const records: LocalFileRecord[] = res.files.map((file) => {
        const cached = syncMap[file.path];
        const validCache = cached && cached.size === file.size && cached.mtimeMs === file.mtimeMs;
        return {
          ...file,
          document: validCache ? cached.document : undefined,
          syncStatus: validCache ? "synced" : "pending",
        };
      });
      setLocalFiles(records);
      const pendingFiles = records.filter((file) => file.syncStatus === "pending");
      void syncPendingFilesGradually(pendingFiles, runId);
    } catch (err) {
      setLocalFiles([]);
      setLocalFilesError(err instanceof Error ? err.message : "No se pudo leer la carpeta local.");
    } finally {
      setLocalFilesLoading(false);
    }
  }, [activeFolder, syncPendingFilesGradually]);

  useEffect(() => {
    void scanActiveFolder();
  }, [scanActiveFolder]);

  const assignmentByDoc = useMemo(() => {
    const map = new Map<string, ApiDocumentAssignment>();
    for (const assignment of assignments) {
      if (assignment.document?.id) map.set(assignment.document.id, assignment);
    }
    return map;
  }, [assignments]);

  const filteredLocalFiles = useMemo(() => {
    return localFiles
      .filter((file) => fileStatus === "TODOS" || getLocalFileType(file) === fileStatus)
      .filter((file) => syncStatusFilter === "TODOS" || file.syncStatus === syncStatusFilter)
      .filter((file) => docStatusFilter === "TODOS" || file.document?.fileStatus === docStatusFilter)
      .filter((file) => collaborationStatus === "TODOS" || file.document?.collaborationStatus === collaborationStatus)
      .filter((file) => sharingStatusFilter === "TODOS" || file.document?.sharingStatus === sharingStatusFilter)
      .filter((file) => {
        if (assignmentStatus === "TODOS") return true;
        if (!file.document) return false;
        const status = getAssignmentStatus(file.document, assignmentByDoc);
        return status === assignmentStatus;
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [
    assignmentByDoc,
    assignmentStatus,
    collaborationStatus,
    docStatusFilter,
    fileStatus,
    localFiles,
    sharingStatusFilter,
    syncStatusFilter,
  ]);

  const typeCounts = useMemo(() => ({
    TODOS: localFiles.length,
    DOCX: localFiles.filter((file) => getLocalFileType(file) === "DOCX").length,
    XLSX: localFiles.filter((file) => getLocalFileType(file) === "XLSX").length,
    PDF: localFiles.filter((file) => getLocalFileType(file) === "PDF").length,
  }), [localFiles]);

  const addFolderPath = (path: string, name?: string) => {
    setWorkspace((prev) => upsertLocalFolder(prev, path, name ?? getFolderNameFromPath(path)));
  };

  const openDocument = (doc: Document) => {
    navigate(getDocumentRoute(doc.id, doc.type), {
      state: { from: location.pathname + location.search },
    });
  };

  const openLocalFile = async (file: LocalFileRecord) => {
    try {
      const api = window.electronAPI;
      if (!api?.openPath) throw new Error("Esta acción requiere la app de escritorio.");
      const opened = await api.openPath(file.path);
      if (!opened.ok) throw new Error(opened.error ?? "No se pudo abrir el archivo.");
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "No se pudo abrir el archivo local.",
        type: "error",
      });
    }
  };

  const openLocalFileDocument = (file: LocalFileRecord) => {
    if (file.document) {
      openDocument(file.document);
      return;
    }
    addToast({
      message: file.syncStatus === "syncing"
        ? "El archivo se está sincronizando. Espera a que termine para abrirlo en el editor."
        : "El archivo aún no está disponible en la nube para abrirlo en el editor.",
      type: file.syncStatus === "error" ? "error" : "info",
    });
  };

  const openLocalDocument = async (doc: Document) => {
    if (!activeFolder) {
      addToast({ message: "Configura una carpeta local primero.", type: "warning" });
      return;
    }

    try {
      const api = window.electronAPI;
      if (!api) throw new Error("Esta acción requiere la app de escritorio.");
      const targetPath = await getLocalFilePath(activeFolder, doc);

      if (!(await api.pathExists(targetPath))) {
        const file = await getShareableDocumentFile(doc.id, doc.name);
        const buffer = await file.arrayBuffer();
        const saved = await api.saveFile(targetPath, buffer);
        if (!saved.ok) throw new Error(saved.error ?? "No se pudo guardar la copia local.");
      }

      const opened = await api.openPath(targetPath);
      if (!opened.ok) throw new Error(opened.error ?? "No se pudo abrir el archivo.");
      addToast({ message: "Archivo abierto en la aplicación local.", type: "success" });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "No se pudo abrir el archivo local.",
        type: "error",
      });
    }
  };

  const handleDeleteDocument = (doc: Document) => {
    if (confirmDeleteDocId === doc.id) {
      if (confirmDeleteSecondsLeft > 0) return;
      if (deleteConfirmTimerRef.current) {
        window.clearInterval(deleteConfirmTimerRef.current);
        deleteConfirmTimerRef.current = null;
      }
      setConfirmDeleteDocId(null);
      setConfirmDeleteSecondsLeft(0);
      void (async () => {
        try {
          await deleteDocument(doc.id, doc.name);
          setLocalFiles((prev) =>
            prev.map((item) =>
              item.document?.id === doc.id
                ? { ...item, document: undefined, syncStatus: "pending", syncError: undefined }
                : item,
            ),
          );
          const sm = readLocalSyncMap();
          for (const p of Object.keys(sm)) {
            if (sm[p]?.document?.id === doc.id) delete sm[p];
          }
          writeLocalSyncMap(sm);
          addToast({ message: `"${doc.name}" se movió a la papelera.`, type: "success" });
          await refresh();
        } catch {
          addToast({ message: "No se pudo eliminar el documento.", type: "error" });
        }
      })();
      return;
    }
    setConfirmDeleteDocId(doc.id);
    setConfirmDeleteSecondsLeft(3);
    if (deleteConfirmTimerRef.current) {
      window.clearInterval(deleteConfirmTimerRef.current);
    }
    deleteConfirmTimerRef.current = window.setInterval(() => {
      setConfirmDeleteSecondsLeft((prev) => {
        if (prev <= 1) {
          if (deleteConfirmTimerRef.current) {
            window.clearInterval(deleteConfirmTimerRef.current);
            deleteConfirmTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLocalDocumentFileStatus = React.useCallback(
    async (filePath: string, doc: Document, status: FileStatus) => {
      if (doc.fileStatus === status) return;
      const previous = doc.fileStatus ?? "ACTIVO";
      setLocalFiles((prev) =>
        prev.map((item) =>
          item.path === filePath && item.document?.id === doc.id
            ? { ...item, document: item.document ? { ...item.document, fileStatus: status } : item.document }
            : item,
        ),
      );
      const syncMap = readLocalSyncMap();
      const entry = syncMap[filePath];
      if (entry?.document.id === doc.id) {
        syncMap[filePath] = { ...entry, document: { ...entry.document, fileStatus: status } };
        writeLocalSyncMap(syncMap);
      }
      try {
        await documentsApi.update(doc.id, { fileStatus: status });
      } catch {
        setLocalFiles((prev) =>
          prev.map((item) =>
            item.path === filePath && item.document?.id === doc.id
              ? { ...item, document: item.document ? { ...item.document, fileStatus: previous } : item.document }
              : item,
          ),
        );
        const sm = readLocalSyncMap();
        const en = sm[filePath];
        if (en?.document.id === doc.id) {
          sm[filePath] = { ...en, document: { ...en.document, fileStatus: previous } };
          writeLocalSyncMap(sm);
        }
        addToast({ message: "No se pudo actualizar el estado del documento.", type: "error" });
      }
    },
    [addToast],
  );

  return (
    <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {getGreeting()}, {user?.name ?? "usuario"}.
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mi escritorio organiza tus documentos cloud con una carpeta local activa para abrirlos en tu equipo.
          </p>
          <div className="mt-4">
            <FolderSlider
              folders={workspace.folders}
              activeFolderId={workspace.activeFolderId}
              onChange={(id) => setWorkspace((prev) => ({ ...prev, activeFolderId: id }))}
            />
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Button type="button" icon={Settings} onClick={() => setSettingsOpen((open) => !open)}>
            Configurar
          </Button>
          <Button type="button" variant="secondary" icon={DownloadCloud} onClick={() => { void scanActiveFolder(); void refresh(); }}>
            Actualizar
          </Button>
          <FolderSettings
            open={settingsOpen}
            workspace={workspace}
            onAddPath={addFolderPath}
            onSetActive={(id) => setWorkspace((prev) => ({ ...prev, activeFolderId: id }))}
            onRemove={(id) => setWorkspace((prev) => removeLocalFolder(prev, id))}
            onClose={() => setSettingsOpen(false)}
            onUnavailable={(message) => addToast({ message, type: "warning", duration: 6000 })}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Archivos"
            action={
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Monitor className="h-4 w-4" />
                {filteredLocalFiles.length} archivo{filteredLocalFiles.length !== 1 ? "s" : ""}
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/20">
              <TypeIconFilter value={fileStatus} onChange={setFileStatus} counts={typeCounts} />
              <CompactFilter
                label="Sincronización"
                value={syncStatusFilter}
                onChange={setSyncStatusFilter}
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "synced", label: "En nube" },
                  { value: "syncing", label: "Sincronizando" },
                  { value: "pending", label: "Pendientes" },
                  { value: "error", label: "Con error" },
                ]}
              />
              <CompactFilter
                label="Estado documento"
                value={docStatusFilter}
                onChange={setDocStatusFilter}
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "ACTIVO", label: "Activos" },
                  { value: "PENDIENTE", label: "Pendientes" },
                  { value: "INACTIVO", label: "Inactivos" },
                ]}
              />
              <CompactFilter
                label="Colaboración"
                value={collaborationStatus}
                onChange={setCollaborationStatus}
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "VISTO", label: "Vistos" },
                  { value: "EDITADO", label: "Editados" },
                  { value: "COMENTADO", label: "Comentados" },
                  { value: "REVISADO", label: "Revisados" },
                  { value: "APROBADO", label: "Aprobados" },
                  { value: "PENDIENTE_REVISION", label: "Pendiente revisión" },
                  { value: "RECHAZADO", label: "Rechazados" },
                ]}
              />
              <CompactFilter
                label="Compartido"
                value={sharingStatusFilter}
                onChange={setSharingStatusFilter}
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "ENVIADO", label: "Enviados" },
                  { value: "ASIGNADO", label: "Asignados" },
                ]}
              />
              <CompactFilter
                label="Asignación"
                value={assignmentStatus}
                onChange={setAssignmentStatus}
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "pendiente", label: "Pendientes" },
                  { value: "visto", label: "Vistos" },
                  { value: "editado", label: "Editados" },
                  { value: "revisado", label: "Revisados" },
                  { value: "completado", label: "Completados" },
                  { value: "rechazado", label: "Rechazados" },
                  { value: "cancelado", label: "Cancelados" },
                ]}
              />
            </div>

            <div className="mt-5">
              {localFilesLoading ? (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <FileCardSkeleton key={index} />
                  ))}
                </div>
              ) : localFilesError ? (
                <EmptyState icon={FileText} title="No se pudieron cargar los archivos locales" description={localFilesError} variant="error" />
              ) : !activeFolder ? (
                <EmptyState icon={FolderOpen} title="Configura una carpeta local" description="Usa Configurar para elegir Escritorio, Documentos, Descargas u otra carpeta." />
              ) : filteredLocalFiles.length === 0 ? (
                <EmptyState icon={FolderOpen} title="No hay archivos para estos filtros" description="La carpeta activa no contiene archivos compatibles o los filtros los están ocultando." />
              ) : (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {filteredLocalFiles.map((file) => (
                    <LocalFileCard
                      key={file.path}
                      file={file}
                      onOpen={() => openLocalFileDocument(file)}
                      onOpenLocal={() => openLocalFile(file)}
                      onShare={() => file.document && setShareDocument(file.document)}
                      onAssign={() => file.document && setAssignDocument(file.document)}
                      onPermissions={() => file.document && setPermissionsDocument(file.document)}
                      onDocumentFileStatusChange={handleLocalDocumentFileStatus}
                      onDeleteDocument={handleDeleteDocument}
                      confirmDeleteDocId={confirmDeleteDocId}
                      confirmDeleteSecondsLeft={confirmDeleteSecondsLeft}
                      onActionMenuClose={() => {
                        if (file.document && confirmDeleteDocId === file.document.id) {
                          setConfirmDeleteDocId(null);
                          setConfirmDeleteSecondsLeft(0);
                          if (deleteConfirmTimerRef.current) {
                            window.clearInterval(deleteConfirmTimerRef.current);
                            deleteConfirmTimerRef.current = null;
                          }
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <DashboardCalendar documents={documents} assignments={assignments} />
          <SectionCard title="Accesos">
            <div className="space-y-2 text-sm">
              <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => navigate("/documentos")}>
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><FileText className="h-4 w-4" /> Documentos</span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </button>
              <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => navigate("/asignados")}>
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><CalendarDays className="h-4 w-4" /> Asignados</span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </button>
              <div className="flex items-center gap-2 rounded-md px-2 py-2 text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Los documentos respaldados muestran la nube en la miniatura.</span>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>

      {shareDocument && (
        <ShareModal
          document={shareDocument}
          onClose={() => setShareDocument(null)}
          onShareLogged={refresh}
        />
      )}
      {assignDocument && <AssignModal document={assignDocument} onClose={() => setAssignDocument(null)} />}
      {permissionsDocument && (
        <DocumentPermissionsModal
          document={permissionsDocument}
          onClose={() => setPermissionsDocument(null)}
          onSave={refresh}
        />
      )}
    </main>
  );
}
