import React, { useState, useEffect, useCallback, useRef } from "react";
import { ViewState, Document } from "./types";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useDocuments } from "./lib/useDocuments";
import { documentsApi } from "./lib/api";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import { Dashboard } from "./components/Dashboard";
import { DocumentsList } from "./components/DocumentsList";
import { AssignedList } from "./components/AssignedList";
import { AgreementsList } from "./components/AgreementsList";
import { DocumentEditor } from "./components/DocumentEditor";
import { ExcelEditor } from "./components/ExcelEditor";
import { ActivityLog } from "./components/ActivityLog";
import { SecurityPage } from "./components/SecurityPage";
import { TrashPage } from "./components/TrashPage";
import { TermsPage } from "./components/TermsPage";
import { PrivacyPage } from "./components/PrivacyPage";
import { SecurityInfoPage } from "./components/SecurityInfoPage";
import { RegisterPage } from "./components/RegisterPage";
import { LoginPage } from "./components/LoginPage";
import { CompleteProfilePage } from "./components/CompleteProfilePage";
import { TeamPage } from "./components/TeamPage";

// ─── Hash routing helpers ───────────────────────────────────────────────────

function parseDocumentHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/document\/([0-9a-f-]{36})$/i);
  return match ? match[1] : null;
}

function setDocumentHash(id: string) {
  window.location.hash = `/document/${id}`;
}

function clearHash() {
  // Replace hash without adding to history
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  const [searchQuery, setSearchQuery] = useState("");

  // Hook que conecta con la API real de documentos
  const {
    documents,
    loading: docsLoading,
    refresh: refreshDocuments,
    deleteDocument,
    updateStatus,
    createDocument,
    total: docsTotal,
  } = useDocuments({ search: searchQuery, autoFetch: !!user });

  const [documentFromTrash, setDocumentFromTrash] = useState<Document | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // ─── Upload modal state ────────────────────────────────────────────────
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Hash-based routing ────────────────────────────────────────────────
  useEffect(() => {
    const handleHashChange = () => {
      const docId = parseDocumentHash();
      if (docId) {
        setDocumentId(docId);
        setCurrentView(ViewState.EDITOR);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Check initial hash on mount
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Redirigir a login si no hay sesión, o a dashboard si ya hay
  useEffect(() => {
    const isAuthView = currentView === ViewState.LOGIN || currentView === ViewState.REGISTER || currentView === ViewState.COMPLETE_PROFILE;
    if (!loading && !user && !isAuthView) {
      setCurrentView(ViewState.LOGIN);
    }
    if (!loading && user && user.needsProfileSetup && currentView !== ViewState.COMPLETE_PROFILE) {
      setCurrentView(ViewState.COMPLETE_PROFILE);
    }
    if (!loading && user && !user.needsProfileSetup && isAuthView) {
      setCurrentView(ViewState.DASHBOARD);
    }
  }, [loading, user, currentView]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  // Pantalla de carga mientras verifica sesión
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary text-white p-4 rounded-xl shadow-lg shadow-primary/20 animate-pulse">
            <span className="material-symbols-outlined text-[48px] block">balance</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Cargando Abogadosoft…</p>
        </div>
      </div>
    );
  }

  // ─── Navigation handlers ───────────────────────────────────────────────

  const handleNavigate = (view: ViewState) => {
    setDocumentFromTrash(null);
    setDocumentId(null);
    if (view !== ViewState.EDITOR && view !== ViewState.EXCEL_EDITOR) {
      clearHash();
    }
    setCurrentView(view);
  };

  /** Abre un documento en el editor con URL única */
  const handleOpenDocument = (docId: string, docType?: string) => {
    setDocumentId(docId);
    setDocumentHash(docId);
    setCurrentView(docType === 'XLSX' || docType === 'xlsx' ? ViewState.EXCEL_EDITOR : ViewState.EDITOR);
  };

  const handleOpenDocumentFromTrash = (doc: Document) => {
    setDocumentFromTrash(doc);
    handleOpenDocument(doc.id, doc.type);
  };

  const handleDeleteDocument = async (doc: Document) => {
    try {
      await deleteDocument(doc.id);
    } catch (err) {
      console.error('Error eliminando documento:', err);
    }
  };

  const handleRestoreDocument = async (doc: Document) => {
    try {
      await documentsApi.restore(doc.id);
      await refreshDocuments();
    } catch (err) {
      console.error('Error restaurando documento:', err);
    }
  };

  const handleEmptyTrash = () => {
    // Se maneja desde TrashPage directamente con la API
  };

  // ─── Upload handlers ──────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setUploadError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setUploadError(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndSave = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      let lastDoc: any = null;
      for (const file of selectedFiles) {
        lastDoc = await documentsApi.upload(file);
      }
      setIsUploadModalOpen(false);
      setSelectedFiles([]);
      await refreshDocuments();
      // Si solo sube un archivo, abre el editor directamente
      if (selectedFiles.length === 1 && lastDoc?.id) {
        handleOpenDocument(lastDoc.id, lastDoc.type);
      }
    } catch (err: any) {
      setUploadError(err.message ?? 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFiles([]);
    setUploadError(null);
    setIsDragOver(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return (
          <Dashboard
            documents={documents}
            onDeleteDocument={handleDeleteDocument}
            onStatusChange={updateStatus}
            onNavigate={setCurrentView}
            onOpenUploadModal={(files) => {
              if (files?.length) setSelectedFiles(prev => [...prev, ...files]);
              setIsUploadModalOpen(true);
            }}
            isUploadModalOpen={isUploadModalOpen}
            searchQuery={searchQuery}
            loading={docsLoading}
            onRefresh={refreshDocuments}
            onOpenDocument={handleOpenDocument}
          />
        );
      case ViewState.DOCUMENTS:
        return <DocumentsList onNavigate={setCurrentView} searchQuery={searchQuery} onOpenDocument={handleOpenDocument} />;
      case ViewState.ASIGNED:
        return <AssignedList onNavigate={setCurrentView} />;
      case ViewState.AGREEMENTS:
        return <AgreementsList onNavigate={setCurrentView} />;
      case ViewState.TEAM:
        return <TeamPage onNavigate={setCurrentView} />;
      case ViewState.EDITOR:
        return <DocumentEditor onNavigate={handleNavigate} documentId={documentId} documentFromTrash={documentFromTrash} />;
      case ViewState.EXCEL_EDITOR:
        return <ExcelEditor onNavigate={handleNavigate} documentFromTrash={documentFromTrash} />;
      case ViewState.ACTIVITY_LOG:
        return <ActivityLog onNavigate={setCurrentView} />;
      case ViewState.SECURITY:
        return <SecurityPage onNavigate={setCurrentView} />;
      case ViewState.TRASH:
        return (
          <TrashPage
            onNavigate={setCurrentView}
            onRefreshDocuments={refreshDocuments}
          />
        );
      case ViewState.TERMS:
        return <TermsPage onNavigate={setCurrentView} />;
      case ViewState.PRIVACY:
        return <PrivacyPage onNavigate={setCurrentView} />;
      case ViewState.SECURITY_INFO:
        return <SecurityInfoPage onNavigate={setCurrentView} />;
      case ViewState.REGISTER:
        return <RegisterPage onNavigate={setCurrentView} />;
      case ViewState.COMPLETE_PROFILE:
        return <CompleteProfilePage onNavigate={setCurrentView} />;
      case ViewState.LOGIN:
        return <LoginPage onNavigate={setCurrentView} />;
      default:
        return (
          <Dashboard
            documents={documents}
            onDeleteDocument={handleDeleteDocument}
            onStatusChange={updateStatus}
            onNavigate={setCurrentView}
            onOpenUploadModal={(files) => {
              if (files?.length) setSelectedFiles(prev => [...prev, ...files]);
              setIsUploadModalOpen(true);
            }}
            isUploadModalOpen={isUploadModalOpen}
            searchQuery={searchQuery}
            loading={docsLoading}
            onRefresh={refreshDocuments}
            onOpenDocument={handleOpenDocument}
          />
        );
    }
  };

  const isAuthView = currentView === ViewState.REGISTER || currentView === ViewState.LOGIN || currentView === ViewState.COMPLETE_PROFILE;

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#111318] dark:text-white">
      {!isAuthView && (
        <AppHeader
          onNavigate={setCurrentView}
          currentView={currentView}
          onUploadClick={() => setIsUploadModalOpen(true)}
          deletedCount={0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
      {renderView()}
      {!isAuthView && <AppFooter onNavigate={setCurrentView} />}

      {/* ─── Upload Modal ─────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeUploadModal();
          }}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 pb-4 text-center">
              <h2 className="text-3xl font-bold text-[#111318] dark:text-white">Agregar Nuevo Documento</h2>
              <p className="text-[#616f89] dark:text-[#a0aec0] mt-2 text-lg">
                Seleccione los archivos que desea guardar en el sistema legal.
              </p>
            </div>
            <div className="px-8 py-6">
              <label
                className={`group relative border-4 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-[#dbdfe6] dark:border-[#2d3748] bg-gray-50 dark:bg-[#101622] hover:border-primary/50 hover:bg-primary/5'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  accept=".doc,.docx,.pdf,.xls,.xlsx,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                />
                <div className={`bg-primary/10 text-primary p-6 rounded-full mb-6 transition-transform ${isDragOver ? 'scale-125' : 'group-hover:scale-110'}`}>
                  <span className="material-symbols-outlined text-6xl">cloud_upload</span>
                </div>
                <p className="text-xl font-semibold text-[#111318] dark:text-white text-center">
                  {isDragOver ? 'Suelte los archivos aquí' : 'Arrastre aquí su archivo o haga clic para buscar'}
                </p>
                <p className="text-[#616f89] dark:text-[#a0aec0] mt-4 text-sm font-medium">
                  Formatos permitidos: Word, PDF, Excel e Imágenes (máx. 50 MB)
                </p>
              </label>

              {/* Lista de archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-bold text-[#111318] dark:text-white">
                    {selectedFiles.length} archivo{selectedFiles.length > 1 ? 's' : ''} seleccionado{selectedFiles.length > 1 ? 's' : ''}
                  </h4>
                  {selectedFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#101622] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748]">
                      <span className="material-symbols-outlined text-primary">description</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111318] dark:text-white truncate">{file.name}</p>
                        <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        disabled={uploading}
                      >
                        <span className="material-symbols-outlined text-xl">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Error message */}
              {uploadError && (
                <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  <span className="material-symbols-outlined">error</span>
                  <p>{uploadError}</p>
                </div>
              )}

              <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary text-sm">
                <span className="material-symbols-outlined">info</span>
                <p>El documento se guardará de forma segura en el expediente correspondiente.</p>
              </div>
            </div>
            <div className="px-8 py-8 flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-[#dbdfe6] dark:border-[#2d3748]">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                onClick={closeUploadModal}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`w-full sm:w-auto px-10 py-3.5 bg-primary text-white text-base font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  selectedFiles.length > 0 && !uploading ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={selectedFiles.length === 0 || uploading}
                onClick={handleUploadAndSave}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Subiendo…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">cloud_upload</span>
                    Subir y Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
