// ============================================================================
// DocumentEditor — Vista de detalle/edición de documento con SuperDoc
// Almacenamiento: Google Drive API (sin WebSockets ni Liveblocks)
// URL única: #/document/:id
// ============================================================================

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Document } from '../types';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { documentsApi, activityApi, ApiDocument, ApiDocumentVersion, ApiDocumentComment, ApiActivityLog, getDocumentFileUrl, getDocumentVersionFileUrl, downloadDocument, permissionsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';
import { saveLocalBlob } from '../lib/download';
import { HistoryTab } from './HistoryTab';
import { CommentsTab } from './CommentsTab';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';
import { ShareModal } from './ShareModal';

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
            {user.name.charAt(0).toUpperCase()}
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
  onReady?: (editor: SuperDoc) => void;
  onUpdate?: () => void;
  onActiveUsersChange?: (users: ActiveUser[]) => void;
}

interface SuperDocEditorRef {
  export: (options?: SuperDocExportOptions) => Promise<Blob | null>;
  setMode: (mode: 'editing' | 'viewing' | 'suggesting') => void;
  getHTML: () => string[];
}

const SuperDocEditor = forwardRef<SuperDocEditorRef, SuperDocEditorProps>(
  ({ documentId, documentBlob, documentName, userName, userEmail, initialMode = 'editing', onReady, onUpdate, onActiveUsersChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const superdocRef = useRef<SuperDoc | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      export: async (options?: SuperDocExportOptions): Promise<Blob | null> => {
        if (!superdocRef.current) throw new Error('Editor not ready');
        const result = await superdocRef.current.export(options as any);
        return result instanceof Blob ? result : null;
      },
      setMode: (mode) => {
        superdocRef.current?.setDocumentMode(mode);
      },
      getHTML: () => {
        return superdocRef.current?.getHTML() || [];
      }
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
            user: { name: userName, email: userEmail },
            documentMode: initialMode,
            viewOptions: { layout: 'print' },
            colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#6366f1', '#f59e0b'],
            onReady: ({ superdoc }: { superdoc: SuperDoc }) => {
              if (destroyed) return;
              setIsReady(true);
              onReady?.(superdoc);
            },
            onEditorUpdate: () => { onUpdate?.(); },
            onException: ({ error }: { error: Error }) => {
              console.error('SuperDoc error:', error);
              setError('Error en el editor de documentos');
            },
          };

          superdocRef.current = new SuperDoc(superdocConfig);
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
    }, [documentBlob, documentId, documentName, userName, userEmail]);

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
      <div className="flex-1 flex flex-col relative">
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
            <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">Cargando editor SuperDoc...</p>
          </div>
        )}
        <div
          ref={containerRef}
          className="superdoc-container flex-1 min-h-[600px]"
          style={{ height: '100%' }}
        />
      </div>
    );
  }
);

SuperDocEditor.displayName = 'SuperDocEditor';

// ─── Main Component ──────────────────────────────────────────────────────────

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentFromTrash }) => {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [rightPanel, setRightPanel] = useState<RightPanel>('COMMENTS');
  const [doc, setDoc] = useState<ApiDocument | null>(null);
  const [documentActivity, setDocumentActivity] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document blob for SuperDoc
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);

  // SuperDoc ref
  const editorRef = useRef<SuperDocEditorRef>(null);

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

  // Effective permission level
  const [effectivePermission, setEffectivePermission] = useState<string>('admin');
  const canEdit = effectivePermission === 'write' || effectivePermission === 'admin';
  const canAdmin = effectivePermission === 'admin';

  // ─── Fetch document ──────────────────────────────────────────────────
  const fetchDocument = useCallback(async () => {
    if (!documentId) {
      setError('No se proporcionó un ID de documento.');
      setLoading(false);
      return;
    }
    try {
      // Solo mostrar loading en la carga inicial, no en refreshes
      setLoading(prev => {
        if (!doc) return true;
        return prev;
      });
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

  const exitCompare = () => {
    setShowDiff(false);
    setIsCompareMode(false);
    setSelectedVersions([]);
    setDiffHtml(null);
  };

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

  const handleDownload = async () => {
    if (!documentId || !doc) return;
    try {
      await downloadDocument(documentId, doc.name);
    } catch (err) {
      console.error('Error al descargar:', err);
    }
  };



  const handleModeChange = (mode: 'editing' | 'viewing' | 'suggesting') => {
    setEditorMode(mode);
    editorRef.current?.setMode(mode);
  };

  // ─── Derived values ─────────────────────────────────────────────────
  const isDocx = doc ? (doc.type?.toUpperCase() === 'DOCX' || doc.type?.toUpperCase() === 'DOC') : false;
  const isPdf = doc?.mimeType === 'application/pdf';
  const isImage = doc?.mimeType?.startsWith('image/');
  const canUseSuperdoc = isDocx && doc?.localPath;
  const [iframeUrl, setIframeUrl] = useState<string>('');

  useEffect(() => {
    if (doc) {
      import('../lib/supabaseAuth').then(({ supabase }) => {
        supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token;
          const url = getDocumentFileUrl(doc.id);
          setIframeUrl(token ? `${url}?token=${token}` : url);
        });
      });
    } else {
      setIframeUrl('');
    }
  }, [doc]);

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

  // ─── Render sub-views ────────────────────────────────────────────────

  const renderEditorContent = () => {
    if (showDiff) {
      const v1 = selectedVersions[0] === 'current' ? doc : versions.find(v => v.id === selectedVersions[0]);
      const v2 = selectedVersions[1] === 'current' ? doc : versions.find(v => v.id === selectedVersions[1]);

      return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-[#0a0a10]">
          {/* Contenedor que simula una hoja A4 de documento */}
          <div className="mx-auto w-full max-w-[850px] min-h-[1100px] bg-white dark:bg-[#121212] px-16 py-24 sm:px-20 shadow-md border border-gray-200 dark:border-white/10 mb-16 text-base text-gray-900 dark:text-gray-100 leading-relaxed text-justify">
            {loadingDiff ? (
              <div className="flex flex-col items-center justify-center pt-32">
                <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-gray-500 font-medium">Renderizando diferencias del documento...</p>
              </div>
            ) : diffHtml ? (
              <div
                className="diff-html-container font-sans"
                dangerouslySetInnerHTML={{ __html: diffHtml }}
              />
            ) : (
              <div className="text-center pt-32 text-gray-500 font-sans">
                No se encontraron diferencias textuales o el documento no pudo ser procesado.
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── SuperDoc Editor for DOCX files ──
    return (
      <div className="w-full flex flex-col min-h-[800px]">
        {/* Mode selector for DOCX */}
        {canUseSuperdoc && (
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 mr-3 font-medium">Modo:</span>
            {canEdit ? (
              <div className="relative isolate flex p-1 bg-gray-200/60 dark:bg-gray-800/80 rounded-xl">
                {/* Sliding background pill */}
                <div
                  className="absolute inset-y-1 left-1 w-28 bg-primary rounded-lg shadow-md transition-transform duration-300 ease-out z-[-1]"
                  style={{
                    transform: `translateX(${editorMode === 'editing' ? '0%' : editorMode === 'suggesting' ? '100%' : '200%'
                      })`
                  }}
                />

                {(['editing', 'suggesting', 'viewing'] as const).map((mode) => (
                  <button
                    key={mode}
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

        {/* Editor area */}
        <div className="flex-1 bg-white dark:bg-[#0f0f1a] rounded-b-lg shadow-sm">
          {canUseSuperdoc ? (
            loadingBlob ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
                <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-gray-500 font-medium">Cargando documento...</p>
              </div>
            ) : documentBlob ? (
              <SuperDocEditor
                ref={editorRef}
                documentId={doc.id}
                documentBlob={documentBlob}
                documentName={doc.name}
                userName={authUser?.name ?? 'Usuario'}
                userEmail={authUser?.email ?? 'usuario@example.com'}
                onReady={() => console.log('[SuperDoc] Editor ready')}
                onUpdate={() => setHasChanges(true)}
                onActiveUsersChange={setActiveUsers}
              />
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
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{doc.type.toUpperCase()}</p>
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
    <div className="bg-background-light dark:bg-background-dark font-display flex-1 flex flex-col">
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
        <aside className="w-64 shrink-0 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col p-4 fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-[#0e0e1b] dark:text-white font-bold text-sm hover:text-primary transition-colors mb-6 -ml-1">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Atrás
          </button>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-primary`}>{getTypeIcon(doc.type)}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">{doc.type.toUpperCase()}</span>
              {canUseSuperdoc && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">SuperDoc</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight">{doc.name}</h1>
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
        <main className={`flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-visible ml-64 min-w-0 transition-all duration-300 ${rightPanel !== 'NONE' ? 'mr-80' : ''}`}>
          <>
            {/* Toolbar */}
            <div className={`fixed left-64 top-16 z-20 h-[87px] flex items-center justify-between bg-white dark:bg-background-dark border-b border-[#e7e7f3] dark:border-white/10 px-6 py-4 transition-all duration-300 ${rightPanel !== 'NONE' ? 'right-80' : 'right-0'}`}>
              <div className="flex items-center gap-3">
                {showDiff ? (
                  <button onClick={exitCompare} className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-700 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                    Salir de Comparación
                  </button>
                ) : (
                  <>
                    {canUseSuperdoc && canEdit && (
                      <>
                        <button
                          onClick={() => handleSaveDocument()}
                          disabled={isSaving || (!hasChanges && !isSaving)}
                          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-blue-700 hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <span className={`material-symbols-outlined ${isSaving ? 'animate-spin' : ''}`}>
                            {isSaving ? 'progress_activity' : 'save'}
                          </span>
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </>
                    )}
                    {canUseSuperdoc && !canEdit && (
                      <span className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                        <span className="material-symbols-outlined text-base">lock</span>
                        Solo lectura
                      </span>
                    )}
                    <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-base hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                      <span className="material-symbols-outlined">download</span>
                      Descargar
                    </button>
                  </>
                )}
                <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-base hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                  <span className="material-symbols-outlined">share</span>
                  Compartir
                </button>
              </div>
              {!showDiff && (
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {/* Active users indicator */}
                  {activeUsers.length > 0 && (
                    <ActiveUsersIndicator users={activeUsers} />
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${hasChanges ? 'text-amber-500' : 'text-green-500'} text-lg`}>
                      {hasChanges ? 'sync_problem' : 'cloud_done'}
                    </span>
                    <span>{hasChanges ? 'Cambios sin guardar' : `Última actualización: ${formatTimeAgo(doc.updatedAt)}`}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Document area */}
            <div className="flex-1 overflow-y-auto pt-[87px] flex flex-col">
              {renderEditorContent()}
            </div>
          </>
        </main>

        {/* Right Sidebar (Displays Comments, History, Details, etc) */}
        {rightPanel !== 'NONE' && (
          <aside className="w-80 shrink-0 border-l border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col fixed right-0 top-16 z-40 h-[calc(100vh-4rem)] shadow-lg">
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
    </div>
  );
};
