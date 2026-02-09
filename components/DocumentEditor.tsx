// ============================================================================
// DocumentEditor — Vista de detalle/edición de documento con SuperDoc
// Integra el editor DOCX de código abierto SuperDoc para edición avanzada
// URL única: #/document/:id
// ============================================================================

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { ViewState, Document } from '../types';
import { documentsApi, ApiDocument, ApiDocumentVersion, ApiDocumentComment, getDocumentFileUrl, downloadDocument } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

type EditorTab = 'EDITOR' | 'HISTORY' | 'COMMENTS' | 'DETAILS';

interface DocumentEditorProps {
  onNavigate: (view: ViewState) => void;
  documentId: string | null;
  documentFromTrash?: Document | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number | string): string {
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days > 1 ? 's' : ''}`;
}

function getTypeIcon(type: string): string {
  switch (type?.toUpperCase()) {
    case 'PDF': case 'pdf': return 'picture_as_pdf';
    case 'DOCX': case 'DOC': case 'docx': case 'doc': return 'description';
    case 'XLSX': case 'XLS': case 'xlsx': case 'xls': return 'table_view';
    default: return 'article';
  }
}

function getShareUrl(documentId: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/document/${documentId}`;
}

// ─── SuperDoc Editor Component ───────────────────────────────────────────────

interface SuperDocEditorProps {
  documentBlob: Blob | null;
  documentName: string;
  userName: string;
  userEmail: string;
  onReady?: (editor: SuperDoc) => void;
  onUpdate?: () => void;
}

interface SuperDocEditorRef {
  export: (options?: { isFinalDoc?: boolean }) => Promise<Blob>;
  setMode: (mode: 'editing' | 'viewing' | 'suggesting') => void;
  getHTML: () => string[];
}

const SuperDocEditor = forwardRef<SuperDocEditorRef, SuperDocEditorProps>(
  ({ documentBlob, documentName, userName, userEmail, onReady, onUpdate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const superdocRef = useRef<SuperDoc | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      export: async (options) => {
        if (!superdocRef.current) throw new Error('Editor not ready');
        return await superdocRef.current.export(options);
      },
      setMode: (mode) => {
        superdocRef.current?.setDocumentMode(mode);
      },
      getHTML: () => {
        return superdocRef.current?.getHTML() || [];
      }
    }));

    useEffect(() => {
      if (!containerRef.current || !documentBlob) return;

      let destroyed = false;

      const initEditor = async () => {
        try {
          setError(null);

          superdocRef.current = new SuperDoc({
            selector: containerRef.current!,
            document: {
              id: documentName,
              type: 'docx',
              data: documentBlob,
            },
            user: {
              name: userName,
              email: userEmail,
            },
            documentMode: 'editing',
            viewOptions: {
              layout: 'print',
            },
            onReady: ({ superdoc }) => {
              if (destroyed) return;
              setIsReady(true);
              onReady?.(superdoc);
            },
            onEditorUpdate: () => {
              onUpdate?.();
            },
            onException: ({ error }) => {
              console.error('SuperDoc error:', error);
              setError('Error en el editor de documentos');
            },
          });
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
    }, [documentBlob, documentName, userName, userEmail]);

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

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ onNavigate, documentId, documentFromTrash }) => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<EditorTab>('EDITOR');
  const [doc, setDoc] = useState<ApiDocument | null>(null);
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

  // Share copied
  const [shareCopied, setShareCopied] = useState(false);

  // Unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Fetch document ──────────────────────────────────────────────────
  const fetchDocument = useCallback(async () => {
    if (!documentId) {
      setError('No se proporcionó un ID de documento.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
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

  // ─── Load document blob for SuperDoc ─────────────────────────────────
  useEffect(() => {
    if (!doc || !doc.localPath) return;

    const isDocx = doc.type?.toLowerCase() === 'docx' || doc.type?.toLowerCase() === 'doc';
    if (!isDocx) return;

    const loadBlob = async () => {
      try {
        setLoadingBlob(true);
        const fileUrl = getDocumentFileUrl(doc.id);

        // Get auth token
        const { supabase } = await import('../lib/supabaseAuth');
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;

        const res = await fetch(fileUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error('No se pudo cargar el documento');

        const blob = await res.blob();
        setDocumentBlob(blob);
      } catch (err: any) {
        console.error('Error loading document blob:', err);
        setError('Error al cargar el archivo para edición');
      } finally {
        setLoadingBlob(false);
      }
    };

    loadBlob();
  }, [doc]);

  // ─── Handlers ────────────────────────────────────────────────────────

  const toggleVersionSelection = (id: string) => {
    if (selectedVersions.includes(id)) {
      setSelectedVersions(selectedVersions.filter(v => v !== id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, id]);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) setShowDiff(true);
  };

  const exitCompare = () => {
    setShowDiff(false);
    setIsCompareMode(false);
    setSelectedVersions([]);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !documentId) return;
    setSubmittingComment(true);
    try {
      await documentsApi.addComment(documentId, { content: newComment.trim() });
      setNewComment('');
      await fetchDocument();
    } catch (err) {
      console.error('Error agregando comentario:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!documentId) return;
    navigator.clipboard.writeText(getShareUrl(documentId));
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!documentId || !doc) return;
    try {
      await downloadDocument(documentId, doc.name);
    } catch (err) {
      console.error('Error al descargar:', err);
    }
  };

  const handleExportDocument = async () => {
    if (!editorRef.current || !doc) return;
    try {
      const blob = await editorRef.current.export({ isFinalDoc: true });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name.endsWith('.docx') ? doc.name : `${doc.name}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHasChanges(false);
    } catch (err) {
      console.error('Error exporting document:', err);
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
  const fileUrl = doc ? getDocumentFileUrl(doc.id) : '';

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
          <button onClick={() => onNavigate(ViewState.DASHBOARD)} className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // ─── Data extraction ─────────────────────────────────────────────────

  const versions = doc.versions ?? [];
  const comments = doc.comments ?? [];
  const caseData = doc.case_ as any;

  // ─── Render sub-views ────────────────────────────────────────────────

  const renderEditorContent = () => {
    if (showDiff) {
      const v1 = versions.find(v => v.id === selectedVersions[0]);
      const v2 = versions.find(v => v.id === selectedVersions[1]);
      return (
        <div className="w-full max-w-[1200px] flex gap-4">
          <div className="flex-1">
            <div className="mb-2 text-center font-bold text-red-600 bg-red-50 py-2 rounded">
              Versión {v1?.version ?? '?'} — {v1 ? formatDate(v1.createdAt) : ''}
            </div>
            <div className="bg-white dark:bg-gray-100 p-10 rounded-sm shadow-md min-h-[400px] text-lg text-gray-800">
              <p className="text-gray-500 italic">Vista previa de comparación.<br />Nota de cambio: {v1?.changeNote ?? 'Sin nota'}</p>
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-2 text-center font-bold text-green-600 bg-green-50 py-2 rounded">
              Versión {v2?.version ?? '?'} — {v2 ? formatDate(v2.createdAt) : ''}
            </div>
            <div className="bg-white dark:bg-gray-100 p-10 rounded-sm shadow-md min-h-[400px] text-lg text-gray-800">
              <p className="text-gray-500 italic">Vista previa de comparación.<br />Nota de cambio: {v2?.changeNote ?? 'Sin nota'}</p>
            </div>
          </div>
        </div>
      );
    }

    // ── SuperDoc Editor for DOCX files ──
    return (
      <div className="w-full flex flex-col min-h-[800px]">
        {/* File info banner */}
        {doc.localPath && (
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 rounded-t-lg">
            <span className="material-symbols-outlined text-primary text-lg">attach_file</span>
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
              <strong>{doc.name}</strong> ({doc.type.toUpperCase()} — {formatFileSize(doc.size)})
            </span>
            {hasChanges && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                Cambios sin guardar
              </span>
            )}
          </div>
        )}

        {/* Mode selector for DOCX */}
        {canUseSuperdoc && (
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 mr-3 font-medium">Modo:</span>
            {(['editing', 'suggesting', 'viewing'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${editorMode === mode
                    ? 'bg-primary text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                <span className="material-symbols-outlined text-base">
                  {mode === 'editing' ? 'edit' : mode === 'suggesting' ? 'rate_review' : 'visibility'}
                </span>
                {mode === 'editing' ? 'Editar' : mode === 'suggesting' ? 'Sugerir' : 'Ver'}
              </button>
            ))}
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 bg-white dark:bg-[#0f0f1a] rounded-b-lg shadow-md overflow-hidden">
          {canUseSuperdoc ? (
            loadingBlob ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
                <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-gray-500 font-medium">Cargando documento...</p>
              </div>
            ) : documentBlob ? (
              <SuperDocEditor
                ref={editorRef}
                documentBlob={documentBlob}
                documentName={doc.name}
                userName={authUser?.name ?? 'Usuario'}
                userEmail={authUser?.email ?? 'usuario@example.com'}
                onReady={() => console.log('SuperDoc ready')}
                onUpdate={() => setHasChanges(true)}
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
              <iframe
                src={fileUrl}
                className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg"
                title={doc.name}
              />
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

  const renderHistoryView = () => (
    <div className="flex-1 overflow-y-auto p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-2">Historial de Auditoría</h2>
        <p className="text-gray-500 mb-8">Registro completo de cambios y accesos al documento.</p>

        {versions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-6xl mb-4 block">history</span>
            <p className="text-lg">Aún no hay versiones registradas.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
            {versions.map((v, idx) => (
              <div key={v.id} className="relative pl-8">
                <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-2 border-white dark:border-background-dark ${idx === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>v{v.version}</span>
                    <span className="text-sm text-gray-400 ml-2">{formatTime(v.createdAt)} - {formatDate(v.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                      {(v.creator?.name ?? '?').charAt(0)}
                    </div>
                    <span className="text-sm font-medium dark:text-gray-300">{v.creator?.name ?? 'Sistema'}</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <p className="text-[#0e0e1b] dark:text-white font-medium mb-1">
                    {v.changeNote ?? (idx === 0 ? 'Versión actual' : 'Actualización del documento')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Tamaño: {formatFileSize(v.size)} — {formatTimeAgo(v.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCommentsView = () => (
    <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-gray-50 dark:bg-[#0a0a14]">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-1">Comentarios</h2>
            <p className="text-gray-500">Discusión activa sobre el documento.</p>
          </div>
        </div>

        {/* New comment form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario…"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-[#0e0e1b] dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submittingComment && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              Comentar
            </button>
          </div>
        </div>

        {comments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-6xl mb-4 block">chat_bubble</span>
            <p className="text-lg">Aún no hay comentarios.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${comment.isResolved ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-blue-100 dark:border-blue-900/30 ring-1 ring-blue-500/10'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {comment.user.avatarUrl ? (
                      <img src={comment.user.avatarUrl} alt={comment.user.name} className="size-10 rounded-full" />
                    ) : (
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {comment.user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-[#0e0e1b] dark:text-white">{comment.user.name}</h4>
                      <p className="text-xs text-gray-500">{formatDate(comment.createdAt)} · {formatTimeAgo(comment.createdAt)}</p>
                    </div>
                  </div>
                  {comment.isResolved ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check</span> Resuelto
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente</span>
                  )}
                </div>
                <p className="text-gray-800 dark:text-gray-200 mb-4 ml-13">{comment.content}</p>

                {/* Replies */}
                {comment.replies && comment.replies.map(reply => (
                  <div key={reply.id} className="ml-8 mt-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm dark:text-white">{reply.user.name}</span>
                      <span className="text-xs text-gray-400">{formatDate(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{reply.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderDetailsView = () => (
    <div className="flex-1 overflow-y-auto p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-2">Detalles del Documento</h2>
        <p className="text-gray-500 mb-8">Información del documento y expediente vinculado.</p>

        {/* Document info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</label>
              <p className="text-lg font-semibold dark:text-white">{doc.name}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</label>
              <p className="text-lg font-semibold dark:text-white">{doc.type.toUpperCase()}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tamaño</label>
              <p className="text-lg font-semibold dark:text-white">{formatFileSize(doc.size)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Versión</label>
              <p className="text-lg font-semibold dark:text-white">v{doc.version}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Propietario</label>
              <p className="text-lg font-semibold dark:text-white">{doc.owner?.name ?? 'Sin asignar'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Última Modificación</label>
              <p className="text-lg font-semibold dark:text-white">{formatDate(doc.updatedAt)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</label>
              <p className="text-lg font-semibold dark:text-white">{doc.fileStatus}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Creado</label>
              <p className="text-lg font-semibold dark:text-white">{formatDate(doc.createdAt)}</p>
            </div>
            {doc.description && (
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descripción</label>
                <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  {doc.description}
                </p>
              </div>
            )}
            {doc.tags && doc.tags.length > 0 && (
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {doc.tags.map(tag => (
                    <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Case info (if linked) */}
        {caseData && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-primary">{caseData.title}</h3>
                <p className="text-sm text-gray-500 font-mono">Expediente #{caseData.caseNumber}</p>
              </div>
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">{caseData.status}</span>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {caseData.client && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente Principal</label>
                  <p className="text-lg font-semibold dark:text-white">{caseData.client}</p>
                </div>
              )}
              {caseData.court && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Juzgado / Instancia</label>
                  <p className="text-lg font-semibold dark:text-white">{caseData.court}</p>
                </div>
              )}
              {caseData.caseType && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo de Proceso</label>
                  <p className="text-lg font-semibold dark:text-white">{caseData.caseType}</p>
                </div>
              )}
              {caseData.startDate && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha de Inicio</label>
                  <p className="text-lg font-semibold dark:text-white">{formatDate(caseData.startDate)}</p>
                </div>
              )}
              {caseData.description && (
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descripción del Caso</label>
                  <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    {caseData.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!caseData && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
            <span className="material-symbols-outlined text-5xl mb-3 block">folder_off</span>
            <p className="text-lg font-medium">Sin expediente vinculado</p>
            <p className="text-sm mt-1">Este documento no está asociado a ningún caso.</p>
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
          <button type="button" onClick={() => onNavigate(ViewState.TRASH)} className="shrink-0 px-4 py-2 rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-sm font-bold hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors">
            Ir a Papelera
          </button>
        </div>
      )}

      <div className="flex grow min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-64 shrink-0 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col p-4 fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto">
          <button type="button" onClick={() => onNavigate(ViewState.DASHBOARD)} className="flex items-center gap-2 text-[#0e0e1b] dark:text-white font-bold text-sm hover:text-primary transition-colors mb-6 -ml-1">
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
              { key: 'EDITOR' as EditorTab, icon: 'edit_document', label: 'Editor' },
              { key: 'HISTORY' as EditorTab, icon: 'history', label: 'Historial' },
              { key: 'COMMENTS' as EditorTab, icon: 'chat_bubble', label: `Comentarios (${comments.length})` },
              { key: 'DETAILS' as EditorTab, icon: 'info', label: 'Detalles' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${activeTab === tab.key ? 'bg-primary text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'
                  }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-hidden ml-64 min-w-0 ${activeTab === 'EDITOR' ? 'mr-80' : ''}`}>
          {activeTab === 'EDITOR' && (
            <>
              {/* Toolbar */}
              <div className="fixed left-64 top-16 right-80 z-20 h-[87px] flex items-center justify-between bg-white dark:bg-background-dark border-b border-[#e7e7f3] dark:border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  {showDiff ? (
                    <button onClick={exitCompare} className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-700 transition-colors">
                      <span className="material-symbols-outlined">close</span>
                      Salir de Comparación
                    </button>
                  ) : (
                    <>
                      {canUseSuperdoc && (
                        <button onClick={handleExportDocument} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                          <span className="material-symbols-outlined">save</span>
                          Exportar DOCX
                        </button>
                      )}
                      <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-base hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined">download</span>
                        Descargar
                      </button>
                    </>
                  )}
                  <button onClick={handleCopyShareLink} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-base hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined">{shareCopied ? 'check' : 'share'}</span>
                    {shareCopied ? 'Copiado' : 'Compartir'}
                  </button>
                </div>
                {!showDiff && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="material-symbols-outlined text-green-500 text-lg">cloud_done</span>
                    <span>Última actualización: {formatTimeAgo(doc.updatedAt)}</span>
                  </div>
                )}
              </div>

              {/* Document area */}
              <div className="flex-1 overflow-y-auto pt-[7rem] flex flex-col">
                {renderEditorContent()}
              </div>
            </>
          )}
          {activeTab === 'HISTORY' && renderHistoryView()}
          {activeTab === 'COMMENTS' && renderCommentsView()}
          {activeTab === 'DETAILS' && renderDetailsView()}
        </main>

        {/* Right Sidebar — Version History (only in Editor tab) */}
        {activeTab === 'EDITOR' && (
          <aside className="w-80 shrink-0 border-l border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col fixed right-0 top-16 z-40 h-[calc(100vh-4rem)]">
            <div className="p-6 border-b border-[#e7e7f3] dark:border-white/10 flex flex-col gap-3">
              <h3 className="text-lg font-bold text-[#0e0e1b] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Historial de Versiones
              </h3>
              {versions.length > 1 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Modo Comparación</span>
                    <button
                      onClick={() => { setIsCompareMode(!isCompareMode); setSelectedVersions([]); setShowDiff(false); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCompareMode ? 'bg-primary' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCompareMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {isCompareMode && (
                    <div className="text-xs text-primary font-bold bg-blue-50 p-2 rounded">
                      Selecciona 2 versiones para comparar
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current version card */}
              <div
                onClick={() => { if (isCompareMode) toggleVersionSelection('current'); }}
                className={`p-4 rounded-xl border-2 border-primary bg-primary/5 transition-all cursor-pointer ${selectedVersions.includes('current') ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
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
                <p className="font-bold text-[#0e0e1b] dark:text-white">v{doc.version} — {formatDate(doc.updatedAt)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Editado por: {doc.owner?.name ?? 'Sistema'}</p>
              </div>

              {/* Previous versions */}
              {versions.map(v => (
                <div
                  key={v.id}
                  onClick={() => { if (isCompareMode) toggleVersionSelection(v.id); }}
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
                    <span className="text-xs font-bold text-gray-400">v{v.version}</span>
                    <span className="text-xs text-gray-500">{formatTime(v.createdAt)}</span>
                  </div>
                  <p className="font-bold text-[#0e0e1b] dark:text-white">{formatDate(v.createdAt)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{v.changeNote ?? 'Sin nota de cambio'}</p>
                  <p className="text-xs text-gray-400 mt-1">Por: {v.creator?.name ?? 'Sistema'} — {formatFileSize(v.size)}</p>
                </div>
              ))}

              {versions.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <span className="material-symbols-outlined text-3xl mb-2 block">history</span>
                  <p className="text-sm">Sin versiones anteriores</p>
                </div>
              )}
            </div>

            {/* Compare button */}
            {isCompareMode && selectedVersions.length === 2 && (
              <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark">
                <button onClick={handleCompare} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-blue-700 transition-colors">
                  <span className="material-symbols-outlined">compare_arrows</span>
                  Comparar Versiones
                </button>
              </div>
            )}

            {/* Document info footer */}
            {!isCompareMode && (
              <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10">
                <div className="flex flex-col gap-3 rounded-xl border border-success-green/30 bg-success-green/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-[#0e0e1b] dark:text-white text-sm font-bold">Documento Activo</p>
                      <p className="text-success-green text-xs font-medium">{doc.fileStatus}</p>
                    </div>
                    <span className="material-symbols-outlined text-success-green">cloud_done</span>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-tight">
                    Tipo: {doc.mimeType ?? doc.type.toUpperCase()} — Creado {formatDate(doc.createdAt)}
                  </p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
