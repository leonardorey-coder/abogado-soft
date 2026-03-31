// ============================================================================
// DocumentEditor — Vista de detalle/edición de documento con SuperDoc
// Almacenamiento: Google Drive API (sin WebSockets ni Liveblocks)
// URL única: #/document/:id
// ============================================================================

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useImperativeHandle, forwardRef, useId } from 'react';
import { Document } from '../types';
import { useNavigate, useParams, Link, useOutletContext, useLocation } from 'react-router-dom';
import type { AppLayoutOutletContext } from './AppLayout';
import { documentsApi, activityApi, ApiDocument, ApiDocumentVersion, ApiDocumentComment, ApiActivityLog, getDocumentFileUrl, getDocumentVersionFileUrl, downloadDocument, permissionsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';
import { saveLocalBlob } from '../lib/download';
import { HistoryTab } from './HistoryTab';
import { CommentsTab } from './CommentsTab';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';
import { ShareModal } from './ShareModal';
import { SuperDocPageStrip } from './SuperDocPageStrip';
import { SuperDocPageSetupModal } from './SuperDocPageSetupModal';

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api';

// SuperDoc export options type (defined locally since not exported from superdoc)
type SuperDocExportOptions = Record<string, unknown>;

type RightPanel = 'NONE' | 'COMMENTS' | 'VERSIONS' | 'HISTORY' | 'DETAILS';
type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed';

interface DocumentEditorProps {
  documentFromTrash?: Document | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeIcon(type: string): string {
  switch (type?.toUpperCase()) {
    case 'PDF': case 'pdf': return 'picture_as_pdf';
    case 'DOCX': case 'DOC': case 'docx': case 'doc': return 'description';
    case 'XLSX': case 'XLS': case 'xlsx': case 'xls': return 'table_view';
    default: return 'article';
  }
}

function getShareUrl(documentId: string): string {
  return `${window.location.origin}/documento/${documentId}`;
}

function EditorPanelToggleIcon({ side }: { side: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-current" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" className="stroke-current" strokeWidth="1.75" />
      {side === 'left' ? (
        <rect x="7" y="8" width="3.5" height="8" rx="0.5" className="fill-current opacity-90" />
      ) : (
        <rect x="13.5" y="8" width="3.5" height="8" rx="0.5" className="fill-current opacity-90" />
      )}
    </svg>
  );
}

// ─── Active Users Component ──────────────────────────────────────────────────

interface ActiveUser {
  name: string;
  email: string;
  color?: string;
}

const ActiveUsersIndicator: React.FC<{ users: ActiveUser[] }> = ({ users }) => {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium">En línea:</span>
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user, idx) => (
          <div
            key={user.email || idx}
            className="size-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: user.color || '#6366f1' }}
            title={user.name}
          >
            {(user.name || '?').charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 5 && (
          <div className="size-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-400 flex items-center justify-center text-[10px] font-bold text-white">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SuperDoc Editor Component with Liveblocks ───────────────────────────────

interface SuperDocEditorProps {
  documentId: string;
  documentBlob: Blob | null;
  documentName: string;
  userName: string;
  userEmail: string;
  initialMode?: 'editing' | 'viewing' | 'suggesting';
  superdocRole?: 'editor' | 'viewer' | 'suggester';
  editorMountRef?: React.RefObject<HTMLDivElement | null>;
  onReady?: (editor: SuperDoc) => void;
  onUpdate?: () => void;
  onActiveUsersChange?: (users: ActiveUser[]) => void;
}

interface SuperDocEditorRef {
  export: (options?: SuperDocExportOptions) => Promise<Blob | null>;
  setMode: (mode: 'editing' | 'viewing' | 'suggesting') => void;
  getHTML: () => string[];
  getSuperDoc: () => SuperDoc | null;
}

const TOOLBAR_FONTS = [
  { label: 'Arial', key: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', key: '"Times New Roman", Times, serif' },
  { label: 'Calibri', key: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Georgia', key: 'Georgia, serif' },
  { label: 'Courier New', key: '"Courier New", Courier, monospace' },
  { label: 'Garamond', key: 'Garamond, "Times New Roman", serif' },
];

const SuperDocEditor = forwardRef<SuperDocEditorRef, SuperDocEditorProps>(
  ({ documentId, documentBlob, documentName, userName, userEmail, initialMode = 'editing', superdocRole = 'editor', editorMountRef, onReady, onUpdate, onActiveUsersChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const superdocRef = useRef<SuperDoc | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reactId = useId();
    const toolbarDomId = `sd-toolbar-${reactId.replace(/:/g, '')}`;

    const setEditorMountRef = useCallback(
      (el: HTMLDivElement | null) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (editorMountRef && 'current' in editorMountRef) {
          (editorMountRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      },
      [editorMountRef]
    );

    const onReadyRef = useRef(onReady);
    const onUpdateRef = useRef(onUpdate);
    onReadyRef.current = onReady;
    onUpdateRef.current = onUpdate;

    useImperativeHandle(ref, () => ({
      export: async (options?: SuperDocExportOptions): Promise<Blob | null> => {
        if (!superdocRef.current) throw new Error('Editor not ready');
        const result = await superdocRef.current.export(options as any);
        return result instanceof Blob ? result : null;
      },
      setMode: (mode) => {
        try {
          superdocRef.current?.setDocumentMode?.(mode);
        } catch (e) {
          console.warn('[SuperDoc] setDocumentMode', e);
        }
      },
      getHTML: () => {
        return superdocRef.current?.getHTML() || [];
      },
      getSuperDoc: () => superdocRef.current,
    }));

    useEffect(() => {
      if (!containerRef.current || !documentBlob || !documentId) return;

      let destroyed = false;

      const initEditor = async () => {
        try {
          setError(null);

          const superdocConfig: any = {
            selector: containerRef.current!,
            document: documentBlob,
            title: documentName,
            user: { name: userName, email: userEmail },
            role: superdocRole,
            documentMode: initialMode,
            rulers: true,
            toolbar: `#${toolbarDomId}`,
            viewOptions: { layout: 'print' },
            colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#6366f1', '#f59e0b'],
            modules: {
              toolbar: {
                selector: `#${toolbarDomId}`,
                hideButtons: false,
                responsiveToContainer: true,
                excludeItems: ['documentMode', 'export'],
                fonts: TOOLBAR_FONTS,
              },
            },
            onReady: ({ superdoc }: { superdoc: SuperDoc }) => {
              if (destroyed) return;
              superdocRef.current = superdoc;
              setIsReady(true);
              onReadyRef.current?.(superdoc);
            },
            onEditorUpdate: () => {
              onUpdateRef.current?.();
            },
            onException: ({ error: ex }: { error: Error }) => {
              console.error('SuperDoc error:', ex);
              setError('Error en el editor de documentos');
            },
          };

          const instance = new SuperDoc(superdocConfig);
          if (!destroyed) superdocRef.current = instance;
        } catch (err: any) {
          console.error('Error initializing SuperDoc:', err);
          setError(err.message || 'Error al inicializar el editor');
        }
      };

      initEditor();

      return () => {
        destroyed = true;
        superdocRef.current?.destroy();
        superdocRef.current = null;
        setIsReady(false);
      };
    }, [documentBlob, documentId, documentName, userName, userEmail, superdocRole, toolbarDomId]);

    useEffect(() => {
      if (!isReady) return;
      try {
        superdocRef.current?.setDocumentMode?.(initialMode);
      } catch (e) {
        console.warn('[SuperDoc] setDocumentMode', e);
      }
    }, [initialMode, isReady]);

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="text-center p-8">
            <span className="material-symbols-outlined text-5xl text-red-400 mb-4 block">error</span>
            <p className="text-red-500 font-medium mb-2">{error}</p>
            <p className="text-gray-500 text-sm">Intenta recargar la página</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative isolate overflow-hidden">
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
            <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">Cargando editor SuperDoc...</p>
          </div>
        )}
        <div
          role="region"
          aria-label="Herramientas de formato del documento"
          className="superdoc-toolbar-scroll shrink-0 z-20 min-w-0 w-full overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 [scrollbar-width:thin]"
        >
          <div
            id={toolbarDomId}
            className="superdoc-toolbar-host min-h-[48px] w-max min-w-full"
          />
        </div>
        <div className="min-h-0 w-full flex-1 overflow-auto bg-white dark:bg-[#0f0f1a]">
          <div
            ref={setEditorMountRef}
            className="superdoc-container mx-auto min-h-[480px] w-full max-w-[56rem] overflow-auto"
          />
        </div>
      </div>
    );
  }
);

SuperDocEditor.displayName = 'SuperDocEditor';

// ─── Main Component ──────────────────────────────────────────────────────────

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentFromTrash }) => {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setEditorTopBar } = useOutletContext<AppLayoutOutletContext>();
  const lastSeededDocIdRef = useRef<string | null>(null);
  const { user: authUser } = useAuth();
  const [rightPanel, setRightPanel] = useState<RightPanel>('COMMENTS');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);

  // Focus mode
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showFocusHint, setShowFocusHint] = useState(false);
  const focusHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelsBeforeFocusRef = useRef<{ left: boolean; right: RightPanel }>({ left: true, right: 'COMMENTS' });
  const [doc, setDoc] = useState<ApiDocument | null>(null);
  const [documentActivity, setDocumentActivity] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document blob for SuperDoc
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);

  // SuperDoc ref
  const editorRef = useRef<SuperDocEditorRef>(null);
  const superDocMountRef = useRef<HTMLDivElement>(null);
  const [pageStripOpen, setPageStripOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [superdocInstance, setSuperdocInstance] = useState<SuperDoc | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Editor mode
  const [editorMode, setEditorMode] = useState<'editing' | 'viewing' | 'suggesting'>('editing');

  // Compare mode (for version history)
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  // New comment  
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Active users for real-time collaboration
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [localFileHandle, setLocalFileHandle] = useState<FileSystemFileHandle | null>(null);

  // New version
  const [newVersionNote, setNewVersionNote] = useState('');
  const [currentVersionNoteDraft, setCurrentVersionNoteDraft] = useState('');
  const [isEditingCurrentVersionNote, setIsEditingCurrentVersionNote] = useState(false);
  const [isSavingVersionNote, setIsSavingVersionNote] = useState(false);
  const versionLoadRequestRef = useRef(0);

  // Diff data
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const [iframeUrl, setIframeUrl] = useState<string>('');

  // Effective permission level
  const [effectivePermission, setEffectivePermission] = useState<string>('admin');
  const canEdit = effectivePermission === 'write' || effectivePermission === 'admin';
  const canAdmin = effectivePermission === 'admin';
  const superdocRole = canEdit ? 'editor' : 'viewer';

  useEffect(() => {
    setSuperdocInstance(null);
    setActivePageIndex(0);
    setLeftSidebarOpen(true);
    // Reset focus mode state when navigating to a different document
    setIsFocusMode(false);
    setShowFocusHint(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // ─── Focus Mode helpers ───────────────────────────────────────────────
  const enterFocusMode = useCallback(() => {
    panelsBeforeFocusRef.current = { left: leftSidebarOpen, right: rightPanel };
    setLeftSidebarOpen(false);
    setRightPanel('NONE');
    setIsFocusMode(true);
    setShowFocusHint(true);
    if (focusHintTimerRef.current) clearTimeout(focusHintTimerRef.current);
    focusHintTimerRef.current = setTimeout(() => setShowFocusHint(false), 3000);
  }, [leftSidebarOpen, rightPanel]);

  const exitFocusMode = useCallback(() => {
    setIsFocusMode(false);
    setShowFocusHint(false);
    if (focusHintTimerRef.current) clearTimeout(focusHintTimerRef.current);
    setLeftSidebarOpen(panelsBeforeFocusRef.current.left);
    setRightPanel(panelsBeforeFocusRef.current.right);
  }, []);

  // Cleanup hint timer on unmount
  useEffect(() => {
    return () => {
      if (focusHintTimerRef.current) clearTimeout(focusHintTimerRef.current);
    };
  }, []);

  // Keyboard shortcut: F to toggle focus, Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (isFocusMode) exitFocusMode(); else enterFocusMode();
        }
      }
      if (e.key === 'Escape' && isFocusMode) {
        exitFocusMode();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, enterFocusMode, exitFocusMode]);

  const [isEditingDocName, setIsEditingDocName] = useState(false);
  const [docNameDraft, setDocNameDraft] = useState('');
  const [docNameSaveError, setDocNameSaveError] = useState<string | null>(null);
  const [isSavingDocName, setIsSavingDocName] = useState(false);
  const docNameInputRef = useRef<HTMLInputElement>(null);
  const [lgUp, setLgUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setLgUp(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const cancelDocNameEdit = useCallback(() => {
    if (doc) setDocNameDraft(doc.name);
    setIsEditingDocName(false);
    setDocNameSaveError(null);
  }, [doc]);

  const startDocNameEdit = useCallback(() => {
    if (!doc || !canEdit) return;
    setDocNameDraft(doc.name);
    setDocNameSaveError(null);
    setIsEditingDocName(true);
    requestAnimationFrame(() => {
      docNameInputRef.current?.focus();
      docNameInputRef.current?.select();
    });
  }, [doc, canEdit]);

  const commitDocNameEdit = useCallback(async () => {
    if (!documentId || !doc) {
      setIsEditingDocName(false);
      return;
    }
    let next = docNameDraft.trim();
    if (!next) {
      cancelDocNameEdit();
      return;
    }
    if (next.length > 500) {
      setDocNameSaveError('Máximo 500 caracteres');
      return;
    }
    const t = doc.type?.toLowerCase();
    if ((t === 'docx' || t === 'doc') && !/\.(docx|doc)$/i.test(next)) {
      next = `${next}.docx`;
    }
    if (next === doc.name) {
      setIsEditingDocName(false);
      setDocNameSaveError(null);
      return;
    }
    setDocNameSaveError(null);
    setIsSavingDocName(true);
    try {
      const updated = await documentsApi.update(documentId, { name: next });
      setDoc(updated);
      setDocNameDraft(updated.name);
      setIsEditingDocName(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar el nombre';
      setDocNameSaveError(msg);
    } finally {
      setIsSavingDocName(false);
    }
  }, [documentId, doc, docNameDraft, cancelDocNameEdit]);

  useEffect(() => {
    setIsEditingDocName(false);
    setDocNameSaveError(null);
  }, [documentId]);

  useLayoutEffect(() => {
    if (!documentId) return;
    const seeded = (location.state as { seededDocument?: ApiDocument } | null)?.seededDocument;
    if (seeded?.id === documentId) {
      lastSeededDocIdRef.current = documentId;
      setDoc(seeded);
      setLoading(false);
      setError(null);
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: {} }
      );
      return;
    }
    if (lastSeededDocIdRef.current === documentId) {
      return;
    }
    lastSeededDocIdRef.current = null;
    setDoc((d) => (d?.id === documentId ? d : null));
    setLoading(true);
  }, [documentId, location.state, location.pathname, location.search, location.hash, navigate]);

  // ─── Fetch document ──────────────────────────────────────────────────
  const fetchDocument = useCallback(async () => {
    if (!documentId) {
      setError('No se proporcionó un ID de documento.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await documentsApi.get(documentId);
      setDoc(data);
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  useEffect(() => {
    if (!documentId) {
      setDocumentActivity([]);
      return;
    }

    activityApi
      .list({
        page: 1,
        limit: 100,
        entityType: 'document',
        entityId: documentId,
      })
      .then((res) => {
        setDocumentActivity(res.data ?? []);
      })
      .catch((err) => {
        console.error('Error al cargar bitácora del documento:', err);
        setDocumentActivity([]);
      });
  }, [documentId]);

  // ─── Fetch effective permission ─────────────────────────────────────
  useEffect(() => {
    if (!documentId) return;
    permissionsApi.getEffective(documentId)
      .then(res => {
        setEffectivePermission(res.permission);
        // If user can't edit, force viewing mode
        if (res.permission !== 'write' && res.permission !== 'admin') {
          setEditorMode('viewing');
        }
      })
      .catch(err => {
        console.warn('Could not fetch effective permission, defaulting to read-only:', err.message);
        setEffectivePermission('read');
        setEditorMode('viewing');
      });
  }, [documentId]);

  // ─── Load document blob for SuperDoc ─────────────────────────────────
  const docId = doc?.id;
  const docLocalPath = doc?.localPath;
  const docType = doc?.type;

  const loadDocumentBlobFromUrl = useCallback(async (url: string, errorMessage: string) => {
    const requestId = ++versionLoadRequestRef.current;
    try {
      setLoadingBlob(true);
      const { supabase } = await import('../lib/supabaseAuth');
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(errorMessage);

      const blob = await res.blob();
      if (requestId === versionLoadRequestRef.current) {
        setDocumentBlob(blob);
      }
    } finally {
      if (requestId === versionLoadRequestRef.current) {
        setLoadingBlob(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!docId || !docLocalPath) return;
    const isDocx = docType?.toLowerCase() === 'docx' || docType?.toLowerCase() === 'doc';
    if (!isDocx) return;

    loadDocumentBlobFromUrl(getDocumentFileUrl(docId), 'No se pudo cargar el documento').catch((err) => {
      console.error('Error loading document blob:', err);
      setError('Error al cargar el archivo para edición');
    });
  }, [docId, docLocalPath, docType, loadDocumentBlobFromUrl]);

  useEffect(() => {
    if (!doc) {
      setIframeUrl('');
      return;
    }
    let cancelled = false;
    import('../lib/supabaseAuth').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        const token = data.session?.access_token;
        const url = getDocumentFileUrl(doc.id);
        setIframeUrl(token ? `${url}?token=${token}` : url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // ─── Save Handlers ───────────────────────────────────────────────────

  const handleSaveDocument = useCallback(async (customChangeNote?: string, isAutoSave = false, createVersion = false) => {
    if (!editorRef.current || !doc || !documentId) return;
    if (isAutoSave && (!hasChanges || isSaving)) return;

    try {
      setIsSaving(true);
      const blob = await editorRef.current.export({
        isFinalDoc: false,
        triggerDownload: false
      });
      if (!blob || blob.size === 0) {
        throw new Error('No se pudo obtener el documento del editor. Intenta editar algo primero.');
      }

      // Usar el nombre original del documento para el archivo
      const fileName = doc.name.endsWith('.docx') ? doc.name : `${doc.name}.docx`;

      const res = await documentsApi.saveVersion(documentId, blob, fileName, customChangeNote, createVersion);
      if (res.ok) {
        setHasChanges(false);

        // Guardado local:
        // - Guardar y Nueva Versión: pide ubicación solo la primera vez (si el navegador lo soporta)
        // - Siguientes guardados (incluida Nueva Versión): reutilizan la misma ruta sin volver a preguntar
        // - Auto: solo escribe en local si ya existe una ruta elegida
        const shouldPersistLocally = !isAutoSave || !!localFileHandle;
        const shouldAskForLocation = !isAutoSave && !localFileHandle;
        if (shouldPersistLocally) {
          try {
            const localName = isAutoSave ? `${doc.name?.replace('.docx', '')}_auto.docx` : fileName;
            const localSaveResult = await saveLocalBlob(blob, localName, {
              fileHandle: localFileHandle,
              askForLocation: shouldAskForLocation
            });
            if (localSaveResult.fileHandle && localSaveResult.fileHandle !== localFileHandle) {
              setLocalFileHandle(localSaveResult.fileHandle);
            }
          } catch (localSaveError: any) {
            if (localSaveError?.name !== 'AbortError') {
              console.warn('No se pudo guardar la copia local:', localSaveError);
            }
          }
        }

        if (createVersion) {
          // Solo para nuevas versiones: actualizar metadatos sin recargar el editor
          try {
            const freshDoc = await documentsApi.get(documentId);
            setDoc(freshDoc);
          } catch { /* ignorar error en refresh */ }
        } else {
          // Guardado normal: actualizar localmente sin ningún fetch
          setDoc(prev => prev ? { ...prev, updatedAt: new Date().toISOString(), size: String(res.size) } : prev);
        }
      } else {
        throw new Error(res.syncResult?.error || 'Error al guardar');
      }
    } catch (err: any) {
      console.error('Error saving document:', err);
      if (!isAutoSave) {
        alert(`Error al guardar: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, [doc, documentId, hasChanges, isSaving, localFileHandle]);

  useEffect(() => {
    setLocalFileHandle(null);
  }, [documentId]);

  // Handle auto-save every 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasChanges && !isSaving) {
        handleSaveDocument(undefined, true);
      }
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [hasChanges, isSaving, handleSaveDocument]);

  const toggleVersionSelection = (id: string) => {
    if (selectedVersions.includes(id)) {
      setSelectedVersions(selectedVersions.filter(v => v !== id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, id]);
    }
  };

  const handleLoadVersion = async (versionId: string) => {
    if (!documentId) return;
    if (versionId === 'current') {
      try {
        await Promise.all([
          fetchDocument(),
          loadDocumentBlobFromUrl(getDocumentFileUrl(documentId), 'No se pudo cargar la versión actual'),
        ]);
      } catch (err: any) {
        console.error('Error loading current version:', err);
      }
      return;
    }

    try {
      await loadDocumentBlobFromUrl(getDocumentVersionFileUrl(documentId, versionId), 'No se pudo cargar la versión');
    } catch (err: any) {
      console.error('Error loading historic version:', err);
    }
  };

  const handleRenameCurrentVersion = useCallback(async () => {
    if (!doc || !documentId) return;
    const currentVersionEntry = (doc.versions ?? []).find(v => v.version === doc.version);
    if (!currentVersionEntry) {
      setIsEditingCurrentVersionNote(false);
      return;
    }

    const normalizedNote = currentVersionNoteDraft.trim();
    try {
      setIsSavingVersionNote(true);
      const updatedVersion = await documentsApi.updateVersionNote(documentId, currentVersionEntry.id, {
        changeNote: normalizedNote || null,
      });
      setDoc(prev => {
        if (!prev) return prev;
        const nextVersions = (prev.versions ?? []).map(v => (v.id === updatedVersion.id ? updatedVersion : v));
        return { ...prev, versions: nextVersions };
      });
      setIsEditingCurrentVersionNote(false);
    } catch (err) {
      console.error('Error renaming current version:', err);
    } finally {
      setIsSavingVersionNote(false);
    }
  }, [doc, documentId, currentVersionNoteDraft]);

  const handleCompare = async () => {
    if (selectedVersions.length !== 2 || !doc || !documentId) return;

    setShowDiff(true);
    setLoadingDiff(true);
    try {
      const getVNum = (id: string) => id === 'current' ? doc.version : versions.find(v => v.id === id)?.version;
      const vNumA = getVNum(selectedVersions[0]); // newer (v2) usually
      const vNumB = getVNum(selectedVersions[1]); // older (v1) usually

      if (vNumA && vNumB) {
        // vNumB = older version, vNumA = newer version
        const res = await documentsApi.getDiff(documentId, vNumB, vNumA);
        setDiffHtml(res.html);
      }
    } catch (error) {
      console.error('Error fetching HTML diff for comparison:', error);
    } finally {
      setLoadingDiff(false);
    }
  };

  const exitCompare = useCallback(() => {
    setShowDiff(false);
    setIsCompareMode(false);
    setSelectedVersions([]);
    setDiffHtml(null);
  }, []);

  const handleAddComment = async (content: string) => {
    if (!documentId) return;
    try {
      await documentsApi.addComment(documentId, { content });
      await fetchDocument();
    } catch (err) {
      console.error('Error agregando comentario:', err);
      throw err;
    }
  };

  const handleDownload = useCallback(async () => {
    if (!documentId || !doc) return;
    try {
      await downloadDocument(documentId, doc.name);
    } catch (err) {
      console.error('Error al descargar:', err);
    }
  }, [documentId, doc]);



  const handleModeChange = (mode: 'editing' | 'viewing' | 'suggesting') => {
    setEditorMode(mode);
    editorRef.current?.setMode(mode);
  };

  // ─── Derived values ─────────────────────────────────────────────────
  const isDocx = doc ? (doc.type?.toUpperCase() === 'DOCX' || doc.type?.toUpperCase() === 'DOC') : false;
  const isPdf = doc?.mimeType === 'application/pdf';
  const isImage = doc?.mimeType?.startsWith('image/');
  const canUseSuperdoc = isDocx && doc?.localPath;

  useLayoutEffect(() => {
    if (loading || error || !doc) {
      setEditorTopBar(null);
      return;
    }

    const headerBtn =
      'inline-flex items-center justify-center gap-1.5 shrink-0 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors [&_.material-symbols-outlined]:text-current';
    const headerBtnPrimary =
      'inline-flex items-center justify-center gap-1.5 shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg font-bold text-xs sm:text-sm bg-primary !text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none transition-colors [&_.material-symbols-outlined]:!text-white';
    const headerBtnExitCompare =
      'inline-flex items-center justify-center gap-1.5 shrink-0 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg font-bold text-xs sm:text-sm border border-slate-700 bg-slate-800 !text-white shadow-sm hover:bg-slate-700 dark:border-slate-600 transition-colors [&_.material-symbols-outlined]:!text-white';

    const panelToggleBtn = (active: boolean) =>
      `inline-flex size-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-slate-200 dark:border-slate-600 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`;

    const rightPanelOpen = rightPanel !== 'NONE';

    // Focus mode button (shown in right slot)
    const focusBtn = (
      <button
        type="button"
        onClick={() => isFocusMode ? exitFocusMode() : enterFocusMode()}
        className={panelToggleBtn(isFocusMode)}
        aria-label={isFocusMode ? 'Salir de modo focus' : 'Entrar en modo focus (F)'}
        title={isFocusMode ? 'Salir (Esc)' : 'Modo Focus (F)'}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isFocusMode ? 'fullscreen_exit' : 'fullscreen'}
        </span>
      </button>
    );

    const leftSlot = (
      <div className="flex w-full items-center justify-center">
        <span className="inline-flex w-9 shrink-0 lg:hidden" aria-hidden />
        <button
          type="button"
          className={`${panelToggleBtn(leftSidebarOpen)} hidden lg:inline-flex`}
          aria-label={leftSidebarOpen ? 'Ocultar panel del documento' : 'Mostrar panel del documento'}
          aria-pressed={leftSidebarOpen}
          onClick={() => setLeftSidebarOpen((v) => !v)}
        >
          <EditorPanelToggleIcon side="left" />
        </button>
      </div>
    );

    const rightSlot = (
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={panelToggleBtn(rightPanelOpen)}
          aria-label={rightPanelOpen ? 'Cerrar panel lateral' : 'Abrir panel lateral'}
          aria-pressed={rightPanelOpen}
          onClick={() => setRightPanel((p) => (p === 'NONE' ? 'COMMENTS' : 'NONE'))}
        >
          <EditorPanelToggleIcon side="right" />
        </button>
        {focusBtn}
      </div>
    );

    setEditorTopBar({
      left: leftSlot,
      right: rightSlot,
      center: (
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {showDiff && (
          <button type="button" onClick={exitCompare} className={headerBtnExitCompare}>
            <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
            <span className="hidden sm:inline">Salir de comparación</span>
          </button>
        )}
        {!showDiff && (
          <>
            {canUseSuperdoc && canEdit && (
              <button
                type="button"
                onClick={() => handleSaveDocument()}
                disabled={isSaving || (!hasChanges && !isSaving)}
                className={headerBtnPrimary}
              >
                <span className={`material-symbols-outlined text-lg sm:text-xl ${isSaving ? 'animate-spin' : ''}`}>
                  {isSaving ? 'progress_activity' : 'save'}
                </span>
                <span className="hidden sm:inline">{isSaving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            )}
            {canUseSuperdoc && !canEdit && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span className="hidden sm:inline">Solo lectura</span>
              </span>
            )}
          </>
        )}
        <button type="button" onClick={handleDownload} className={headerBtn}>
          <span className="material-symbols-outlined text-lg sm:text-xl">download</span>
          <span className="hidden sm:inline">Descargar</span>
        </button>
        <button type="button" onClick={() => setShowShareModal(true)} className={headerBtn}>
          <span className="material-symbols-outlined text-lg sm:text-xl">share</span>
          <span className="hidden sm:inline">Compartir</span>
        </button>
        {!showDiff && canUseSuperdoc && (
          <>
            <button
              type="button"
              onClick={() => setPageStripOpen((v) => !v)}
              title={pageStripOpen ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
              className={`${headerBtn} ${pageStripOpen ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20' : ''}`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">view_carousel</span>
              <span className="hidden lg:inline">Páginas</span>
            </button>
            {canEdit && (
              <button type="button" onClick={() => setPageSetupOpen(true)} className={headerBtn}>
                <span className="material-symbols-outlined text-lg sm:text-xl">settings</span>
                <span className="hidden sm:inline">Página</span>
              </button>
            )}
          </>
        )}
        {!showDiff && (
          <div className="hidden md:flex items-center gap-2 sm:gap-3 ml-1 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs shrink-0">
            {activeUsers.length > 0 && <ActiveUsersIndicator users={activeUsers} />}
            <div className="flex items-center gap-1 min-w-0">
              <span className={`material-symbols-outlined shrink-0 text-base ${hasChanges ? 'text-amber-500' : 'text-green-500'}`}>
                {hasChanges ? 'sync_problem' : 'cloud_done'}
              </span>
              <span className="truncate max-w-[10rem] sm:max-w-[14rem]">
                {hasChanges ? 'Cambios sin guardar' : `Última actualización: ${formatTimeAgo(doc.updatedAt)}`}
              </span>
            </div>
          </div>
        )}
        </div>
      ),
    });

    return () => setEditorTopBar(null);
  }, [
    setEditorTopBar,
    leftSidebarOpen,
    rightPanel,
    loading,
    error,
    doc,
    showDiff,
    canUseSuperdoc,
    canEdit,
    isSaving,
    hasChanges,
    handleSaveDocument,
    handleDownload,
    exitCompare,
    pageStripOpen,
    activeUsers,
    setShowShareModal,
  ]);

  // ─── Loading / Error states ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-background-light dark:bg-background-dark flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400">Cargando documento…</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="bg-background-light dark:bg-background-dark flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4 block">error</span>
          <h2 className="text-2xl font-bold text-[#0e0e1b] dark:text-white mb-2">Error al cargar documento</h2>
          <p className="text-gray-500 mb-6">{error ?? 'Documento no encontrado'}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // ─── Data extraction ─────────────────────────────────────────────────

  const versions = doc.versions ?? [];
  const currentVersionEntry = versions.find(v => v.version === doc.version) ?? null;
  const historicalVersions = versions.filter(v => v.version !== doc.version);
  const comments = doc.comments ?? [];
  const caseData = doc.case_ as any;

  const renderDocNameControl = (layout: 'sidebar' | 'mobile') => {
    const inputCls =
      layout === 'sidebar'
        ? 'w-full text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1'
        : 'w-full min-w-0 text-sm font-semibold text-[#0e0e1b] dark:text-white bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1';
    const btnCls =
      layout === 'sidebar'
        ? 'text-left w-full text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight hover:text-primary rounded-lg -mx-1 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30'
        : 'text-left w-full min-w-0 truncate text-sm font-semibold text-[#0e0e1b] dark:text-white hover:text-primary rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30';

    if (!canEdit) {
      return layout === 'sidebar' ? (
        <h1 className="text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight">{doc.name}</h1>
      ) : (
        <span className="block truncate text-sm font-semibold text-[#0e0e1b] dark:text-white">{doc.name}</span>
      );
    }

    if (isEditingDocName) {
      return (
        <div className="space-y-1 w-full min-w-0">
          <input
            ref={docNameInputRef}
            value={docNameDraft}
            onChange={(e) => setDocNameDraft(e.target.value)}
            onBlur={() => { void commitDocNameEdit(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitDocNameEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelDocNameEdit();
              }
            }}
            disabled={isSavingDocName}
            className={inputCls}
            aria-label="Nombre del documento"
          />
          {docNameSaveError && <p className="text-xs text-red-600 dark:text-red-400">{docNameSaveError}</p>}
        </div>
      );
    }

    return (
      <button type="button" onClick={startDocNameEdit} className={btnCls} title="Cambiar nombre">
        {doc.name}
      </button>
    );
  };

  // ─── Render sub-views ────────────────────────────────────────────────

  const renderEditorContent = () => {
    if (showDiff) {
      return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-[#0a0a10]">
          {loadingDiff ? (
            <div className="mx-auto w-full max-w-[850px] min-h-[600px] bg-white dark:bg-[#121212] shadow-md border border-gray-200 dark:border-white/10 flex flex-col items-center justify-center">
              <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
              <p className="text-gray-500 font-medium">Renderizando diferencias del documento...</p>
            </div>
          ) : diffHtml ? (
            <div className="mx-auto w-full max-w-[850px] bg-white dark:bg-[#121212] shadow-md border border-gray-200 dark:border-white/10 mb-16">
              <style>{`
                .diff-doc-container {
                  padding: 72px 80px;
                  font-family: 'Times New Roman', 'Cambria', Georgia, serif;
                  font-size: 12pt;
                  line-height: 1.5;
                  color: #1a1a1a;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                @media (max-width: 640px) {
                  .diff-doc-container { padding: 40px 24px; }
                }
                .dark .diff-doc-container { color: #e5e5e5; }
                .diff-doc-container h1 { font-size: 20pt; font-weight: 700; margin: 24px 0 8px; }
                .diff-doc-container h2 { font-size: 16pt; font-weight: 700; margin: 20px 0 6px; }
                .diff-doc-container h3 { font-size: 13pt; font-weight: 700; margin: 16px 0 4px; }
                .diff-doc-container p { margin: 0 0 8px; text-align: justify; }
                .diff-doc-container ul, .diff-doc-container ol { margin: 8px 0; padding-left: 28px; }
                .diff-doc-container li { margin-bottom: 4px; }
                .diff-doc-container img { max-width: 100%; height: auto; margin: 12px 0; }
                .diff-doc-container table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 12px 0;
                  font-size: 11pt;
                }
                .diff-doc-container th,
                .diff-doc-container td {
                  border: 1px solid #666;
                  padding: 6px 10px;
                  text-align: left;
                  vertical-align: top;
                }
                .diff-doc-container th {
                  font-weight: 700;
                  background: #f3f4f6;
                }
                .dark .diff-doc-container th { background: #1e293b; }
                .dark .diff-doc-container th,
                .dark .diff-doc-container td { border-color: #475569; }
                .diff-doc-container a { color: #2563eb; text-decoration: underline; }
                .diff-doc-container ins {
                  background: #bbf7d0;
                  color: #14532d;
                  text-decoration: none;
                  padding: 1px 2px;
                  border-radius: 2px;
                }
                .diff-doc-container del {
                  background: #fecaca;
                  color: #7f1d1d;
                  text-decoration: line-through;
                  padding: 1px 2px;
                  border-radius: 2px;
                }
                .dark .diff-doc-container ins { background: #166534; color: #bbf7d0; }
                .dark .diff-doc-container del { background: #991b1b; color: #fecaca; }
              `}</style>
              <div
                className="diff-doc-container"
                dangerouslySetInnerHTML={{ __html: diffHtml }}
              />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[850px] min-h-[400px] bg-white dark:bg-[#121212] shadow-md border border-gray-200 dark:border-white/10 flex items-center justify-center">
              <p className="text-gray-500 font-sans">
                No se encontraron diferencias textuales o el documento no pudo ser procesado.
              </p>
            </div>
          )}
        </div>
      );
    }

    // ── SuperDoc Editor for DOCX files ──
    return (
      <div className="w-full flex flex-col min-h-[800px]">
        {/* Editor area */}
        <div className="flex-1 bg-white dark:bg-[#0f0f1a] rounded-b-lg shadow-sm min-h-0 flex flex-col">
          {canUseSuperdoc ? (
            loadingBlob ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
                <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-gray-500 font-medium">Cargando documento...</p>
              </div>
            ) : documentBlob ? (
              <div className="flex flex-1 min-h-[560px] min-w-0 flex-col lg:flex-row">
                <SuperDocPageStrip
                  editorMountRef={superDocMountRef}
                  activePageIndex={activePageIndex}
                  onActiveChange={setActivePageIndex}
                  collapsed={!pageStripOpen}
                  leftDockOpen={leftSidebarOpen}
                />
                <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
                  <SuperDocEditor
                    ref={editorRef}
                    documentId={doc.id}
                    documentBlob={documentBlob}
                    documentName={doc.name}
                    userName={authUser?.name ?? 'Usuario'}
                    userEmail={authUser?.email ?? 'usuario@example.com'}
                    initialMode={editorMode}
                    superdocRole={superdocRole}
                    editorMountRef={superDocMountRef}
                    onReady={(sd) => {
                      setSuperdocInstance(sd);
                    }}
                    onUpdate={() => setHasChanges(true)}
                    onActiveUsersChange={setActiveUsers}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
                <span className="material-symbols-outlined text-5xl text-gray-400 mb-4">description</span>
                <p className="text-gray-500">No se pudo cargar el documento para edición</p>
              </div>
            )
          ) : isPdf || isImage ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] p-4">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Vista previa de {isPdf ? 'PDF' : 'imagen'}
              </p>
              {iframeUrl ? (
                <iframe
                  src={iframeUrl}
                  className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white"
                  title={doc?.name || 'Documento'}
                />
              ) : (
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-4"></div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
              <span className="material-symbols-outlined text-6xl text-gray-400 mb-4">description</span>
              <p className="text-gray-500 text-lg">Este tipo de archivo no soporta edición en línea</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Descargar archivo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryView = () => {
    const timelineData = currentVersionEntry
      ? [currentVersionEntry, ...historicalVersions]
      : historicalVersions;
    return <HistoryTab versions={timelineData as any} activityLogs={documentActivity} />;
  };

  const renderCommentsView = () => <CommentsTab comments={comments as any} onAddComment={handleAddComment} />;

  const renderDetailsView = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Document info */}
      <div className="space-y-4">
        <h3 className="font-bold text-[#0e0e1b] dark:text-white text-lg border-b border-gray-200 dark:border-gray-800 pb-2">Información Principal</h3>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{doc.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tipo</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{(doc.type ?? '').toUpperCase() || '—'}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tamaño</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatFileSize(doc.size)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Versión</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">v{doc.version}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Estado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{doc.fileStatus}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Propietario</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{doc.owner?.name ?? 'Sin asignar'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Modificado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(doc.updatedAt)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Creado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(doc.createdAt)}</p>
          </div>
        </div>

        {doc.description && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Descripción</label>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-[#e7e7f3] dark:border-white/10">
              {doc.description}
            </p>
          </div>
        )}
        {doc.tags && doc.tags.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {doc.tags.map(tag => (
                <span key={tag} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Case info */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-[#0e0e1b] dark:text-white text-lg pb-1">Expediente</h3>
        {caseData ? (
          <>
            <div>
              <p className="text-sm font-bold text-primary break-words">{caseData.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Exp. #{caseData.caseNumber}</span>
                <span className="text-[10px] font-bold bg-green-100 text-green-800 px-1.5 py-0.5 rounded">{caseData.status}</span>
              </div>
            </div>

            {caseData.client && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cliente</label>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{caseData.client}</p>
              </div>
            )}
            {caseData.court && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Juzgado</label>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{caseData.court}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <span className="material-symbols-outlined text-gray-400 mb-2">folder_off</span>
            <p className="text-xs text-gray-500 font-medium">Sin expediente vinculado</p>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Main Render ─────────────────────────────────────────────────────

  return (
    <div className="bg-background-light dark:bg-background-dark font-display flex-1 flex flex-col relative">
      {/* Focus mode hint overlay */}
      {showFocusHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[100] flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 dark:bg-white/10 backdrop-blur-sm text-white text-sm font-semibold shadow-xl border border-white/10">
            <span className="material-symbols-outlined text-[16px] text-primary">fullscreen</span>
            Modo Focus activo — <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono">Esc</kbd> para salir
          </div>
        </div>
      )}

      {/* Trash warning banner */}
      {documentFromTrash && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <span className="material-symbols-outlined text-xl shrink-0">info</span>
          <p className="text-sm font-medium flex-1">
            Este documento está en la papelera. Para devolverlo a la lista principal, restáuralo desde la página Papelera.
          </p>
          <button type="button" onClick={() => navigate('/papelera')} className="shrink-0 px-4 py-2 rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-sm font-bold hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors">
            Ir a Papelera
          </button>
        </div>
      )}

      <div className="flex grow min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside
          className={`hidden w-64 shrink-0 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex-col p-4 fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto ${
            leftSidebarOpen ? 'lg:flex' : 'lg:hidden'
          }`}
        >
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-[#0e0e1b] dark:text-white font-bold text-sm hover:text-primary transition-colors mb-6 -ml-1">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Atrás
          </button>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-primary`}>{getTypeIcon(doc.type)}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">{(doc.type ?? '').toUpperCase() || '—'}</span>
              {canUseSuperdoc && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">SuperDoc</span>
              )}
            </div>
            {lgUp ? renderDocNameControl('sidebar') : null}
            <p className="text-gray-500 text-sm mt-1">v{doc.version} — {formatFileSize(doc.size)}</p>
            {doc.owner && <p className="text-gray-400 text-xs mt-1">Por: {doc.owner.name}</p>}
          </div>
          <nav className="flex flex-col gap-2 grow">
            {([
              { key: 'COMMENTS' as RightPanel, icon: 'chat_bubble', label: `Comentarios (${comments.length})` },
              { key: 'VERSIONS' as RightPanel, icon: 'layers', label: 'Versiones' },
              { key: 'HISTORY' as RightPanel, icon: 'history', label: 'Historial' },
              { key: 'DETAILS' as RightPanel, icon: 'info', label: 'Detalles' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${rightPanel === tab.key
                  ? 'bg-primary text-white font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'
                  }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content (Always shows editor + toolbar) */}
        <main
          className={`flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-hidden min-w-0 transition-[margin] duration-300 ${
            leftSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
          } ${rightPanel !== 'NONE' ? 'lg:mr-80' : ''}`}
        >
          <>
            {!lgUp && (
              <div className="fixed left-0 right-0 top-16 z-[31] h-11 flex items-center px-4 border-b border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark min-w-0">
                {renderDocNameControl('mobile')}
              </div>
            )}

            {canUseSuperdoc && !showDiff && (
              <div
                className={`fixed z-[29] min-h-12 flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-[left,right] duration-300 top-[6.75rem] lg:top-16 left-0 right-0 ${
                  leftSidebarOpen ? 'lg:left-64' : 'lg:left-0'
                } ${rightPanel !== 'NONE' ? 'lg:right-80' : ''}`}
              >
                <span className="text-xs text-gray-500 mr-3 font-medium">Modo:</span>
                {canEdit ? (
                  <div className="relative isolate flex p-1 bg-gray-200/60 dark:bg-gray-800/80 rounded-xl">
                    <div
                      className="absolute inset-y-1 left-1 w-28 bg-primary rounded-lg shadow-md transition-transform duration-300 ease-out z-[-1]"
                      style={{
                        transform: `translateX(${editorMode === 'editing' ? '0%' : editorMode === 'suggesting' ? '100%' : '200%'})`,
                      }}
                    />
                    {(['editing', 'suggesting', 'viewing'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleModeChange(mode)}
                        className={`flex items-center justify-center gap-1.5 w-28 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-300 ${editorMode === mode
                          ? 'text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {mode === 'editing' ? 'edit' : mode === 'suggesting' ? 'rate_review' : 'visibility'}
                        </span>
                        {mode === 'editing' ? 'Editar' : mode === 'suggesting' ? 'Sugerir' : 'Ver'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <span className="material-symbols-outlined text-base">visibility</span>
                    Solo lectura
                  </span>
                )}
              </div>
            )}

            {/* Document area */}
            <div
              className={`flex-1 overflow-y-auto pb-24 lg:pb-0 flex flex-col isolate ${
                canUseSuperdoc && !showDiff
                  ? 'pt-[calc(2.75rem+3rem)] lg:pt-14'
                  : 'pt-[2.75rem] lg:pt-0'
              }`}
            >
              {renderEditorContent()}
            </div>
          </>
        </main>

        {/* Right Sidebar (Displays Comments, History, Details, etc) */}
        {rightPanel !== 'NONE' && (
          <aside className="w-full lg:w-80 shrink-0 border-l border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col fixed right-0 top-16 z-50 lg:z-40 h-[calc(100vh-4rem)] shadow-2xl lg:shadow-lg">
            {/* Header for the right panel */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e7e7f3] dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50">
              <span className="font-black text-[#0e0e1b] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  {rightPanel === 'COMMENTS' && 'chat_bubble'}
                  {rightPanel === 'VERSIONS' && 'layers'}
                  {rightPanel === 'HISTORY' && 'history'}
                  {rightPanel === 'DETAILS' && 'info'}
                </span>
                {rightPanel === 'COMMENTS' && 'Comentarios'}
                {rightPanel === 'VERSIONS' && 'Versiones'}
                {rightPanel === 'HISTORY' && 'Historial Completo'}
                {rightPanel === 'DETAILS' && 'Detalles'}
              </span>
              <button onClick={() => setRightPanel('NONE')} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="material-symbols-outlined text-lg block">close</span>
              </button>
            </div>

            {/* Render right panel content dynamically */}
            {rightPanel === 'COMMENTS' && renderCommentsView()}

            {rightPanel === 'VERSIONS' && (
              <>
                <div className="p-4 border-b border-[#e7e7f3] dark:border-white/10 flex flex-col gap-3">
                  {historicalVersions.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Modo Comparación</span>
                        <button
                          onClick={() => { setIsCompareMode(!isCompareMode); setSelectedVersions([]); setShowDiff(false); }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCompareMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCompareMode ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {isCompareMode && (
                        <div className="text-xs text-primary font-bold bg-blue-50 dark:bg-primary/10 p-2.5 rounded-lg">
                          Selecciona 2 versiones para comparar
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Create New Version Card */}
                  {!isCompareMode && hasChanges && (
                    <div className="p-4 rounded-xl border border-primary bg-primary/5 shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Nueva Versión</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input type="text" className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                          placeholder="Nota (opcional)"
                          value={newVersionNote}
                          onChange={e => setNewVersionNote(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleSaveDocument(newVersionNote || undefined, false, true);
                              setNewVersionNote('');
                            }
                          }}
                        />
                        <button onClick={() => { handleSaveDocument(newVersionNote || undefined, false, true); setNewVersionNote(''); }}
                          className="bg-primary text-white p-2 text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold h-full flex items-center justify-center"
                          title="Guardar">
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Current version card */}
                  <div
                    onClick={() => {
                      if (isCompareMode) toggleVersionSelection('current');
                      else handleLoadVersion('current');
                    }}
                    className={`relative p-4 rounded-xl border transition-all cursor-pointer ${selectedVersions.includes('current') ? 'border-primary ring-2 ring-offset-2 ring-primary bg-primary/5' : 'border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5'}`}
                  >
                    {isCompareMode && (
                      <div className="absolute top-3 right-3">
                        <div className={`size-5 rounded border flex items-center justify-center ${selectedVersions.includes('current') ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                          {selectedVersions.includes('current') && <span className="material-symbols-outlined text-white text-xs">check</span>}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-primary text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">Versión Actual</span>
                      <span className="text-xs text-gray-500">{formatTime(doc.updatedAt)}</span>
                    </div>

                    <div className="flex items-center gap-2 group/edit">
                      {!isEditingCurrentVersionNote ? (
                        <>
                          <p className="font-bold text-[#0e0e1b] dark:text-white text-lg">
                            v{doc.version}
                          </p>
                          <p className="text-[#0e0e1b] dark:text-gray-300 font-medium ml-1 flex-1">— {formatDate(doc.updatedAt)}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentVersionNoteDraft(currentVersionEntry?.changeNote ?? '');
                              setIsEditingCurrentVersionNote(true);
                            }}
                            disabled={!currentVersionEntry}
                            className="text-gray-400 hover:text-primary opacity-0 group-hover/edit:opacity-100 transition-opacity disabled:opacity-30 disabled:hover:text-gray-400"
                            title="Renombrar versión actual"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                          <input autoFocus type="text" className="flex-1 text-sm border font-bold border-gray-300 rounded px-2 py-1 outline-none focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            value={currentVersionNoteDraft}
                            onChange={e => setCurrentVersionNoteDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleRenameCurrentVersion();
                              } else if (e.key === 'Escape') {
                                setIsEditingCurrentVersionNote(false);
                                setCurrentVersionNoteDraft('');
                              }
                            }}
                          />
                          <button
                            onClick={handleRenameCurrentVersion}
                            disabled={isSavingVersionNote}
                            className="text-green-500 p-0.5 rounded hover:bg-green-100 bg-white shadow-sm border border-gray-100 disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[18px]">check</span>
                          </button>
                          <button
                            onClick={() => { setIsEditingCurrentVersionNote(false); setCurrentVersionNoteDraft(''); }}
                            disabled={isSavingVersionNote}
                            className="text-red-500 p-0.5 rounded hover:bg-red-100 bg-white shadow-sm border border-gray-100 disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{currentVersionEntry?.changeNote ?? 'Sin nota de cambio'}</p>
                    <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700">Editado por: {doc.owner?.name ?? 'Sistema'}</p>
                  </div>

                  {/* Previous versions */}
                  {historicalVersions.map(v => (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (isCompareMode) toggleVersionSelection(v.id);
                        else handleLoadVersion(v.id);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer group relative border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5 ${selectedVersions.includes(v.id) ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    >
                      {isCompareMode && (
                        <div className="absolute top-3 right-3">
                          <div className={`size-5 rounded border flex items-center justify-center ${selectedVersions.includes(v.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                            {selectedVersions.includes(v.id) && <span className="material-symbols-outlined text-white text-xs">check</span>}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2 pr-6">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">v{v.version}</span>
                        <span className="text-xs text-gray-500">{formatTime(v.createdAt)}</span>
                      </div>
                      <p className="font-bold text-[#0e0e1b] dark:text-white mt-1">{formatDate(v.createdAt)}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{v.changeNote ?? 'Sin nota de cambio'}</p>
                      <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700 flex justify-between">
                        <span>Por: {v.creator?.name ?? 'Sistema'}</span>
                        <span>{formatFileSize(v.size)}</span>
                      </p>
                    </div>
                  ))}

                  {historicalVersions.length === 0 && (
                    <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl border-gray-200">
                      <span className="material-symbols-outlined text-3xl mb-2 block">history</span>
                      <p className="text-sm">Sin versiones anteriores</p>
                    </div>
                  )}
                </div>

                {/* Compare button */}
                {isCompareMode && selectedVersions.length === 2 && (
                  <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-10 relative">
                    <button onClick={handleCompare} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-blue-700 hover:scale-[1.02] transition-all">
                      <span className="material-symbols-outlined">compare_arrows</span>
                      Comparar Versiones
                    </button>
                  </div>
                )}
              </>
            )}

            {rightPanel === 'HISTORY' && (
              <div className="flex-1 overflow-y-auto w-full">
                {renderHistoryView()}
              </div>
            )}

            {rightPanel === 'DETAILS' && (
              <div className="flex-1 overflow-y-auto w-full bg-white dark:bg-[#0a0a10]">
                {renderDetailsView()}
              </div>
            )}
          </aside>
        )}
      </div>

      {showShareModal && doc && (
        <ShareModal document={doc as any} onClose={() => setShowShareModal(false)} />
      )}

      <SuperDocPageSetupModal
        open={pageSetupOpen}
        superdoc={superdocInstance}
        onClose={() => setPageSetupOpen(false)}
      />

      {/* Mobile Editor Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 pb-safe flex items-center justify-around h-16 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {([
          { key: 'COMMENTS' as RightPanel, icon: 'chat_bubble', label: 'Comentarios' },
          { key: 'VERSIONS' as RightPanel, icon: 'layers', label: 'Versiones' },
          { key: 'HISTORY' as RightPanel, icon: 'history', label: 'Historial' },
          { key: 'DETAILS' as RightPanel, icon: 'info', label: 'Detalles' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${
              rightPanel === tab.key ? 'text-primary dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {rightPanel === tab.key && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />
            )}
            <div className={`p-1 rounded-xl transition-colors ${rightPanel === tab.key ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            </div>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
