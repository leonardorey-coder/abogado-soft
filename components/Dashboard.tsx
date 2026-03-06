import React, { useState, useRef, useEffect, useCallback } from "react";
import { Document, FileStatus, CollaborationStatus, SharingStatus, DocumentPermissionLevel } from "../types";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { useDocuments } from "../lib/useDocuments";
import { getDocumentFileUrl } from '../lib/api';
import { supabase } from '../lib/supabaseAuth';
import { ShareModal } from "./ShareModal";
import { AdminAccessModal } from "./AdminAccessModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { AssignModal } from "./AssignModal";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import { SuperDoc } from "superdoc";
import "superdoc/style.css";

// Tipo del contexto que provee AppLayout vía <Outlet context={...}>
interface LayoutContext {
  searchQuery: string;
  openUploadModal: (files?: File[]) => void;
  refreshDocuments: () => Promise<void>;
}

interface DashboardProps {
  onOpenUploadModal?: (files?: File[]) => void;
  isUploadModalOpen?: boolean;
  searchQuery?: string;
  onOpenDocument?: (docId: string, docType?: string) => void;
}

const permissionLabel: Record<DocumentPermissionLevel, string> = {
  none: "Sin Acceso",
  download: "Puede Descargar",
  read: "Lectura",
  write: "Escritura",
  admin: "Administrador",
};

const getFileStatusColor = (status: FileStatus) => {
  switch (status) {
    case 'ACTIVO': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'INACTIVO': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getCollaborationStatusColor = (status: CollaborationStatus) => {
  switch (status) {
    case 'VISTO': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'EDITADO': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    case 'COMENTADO': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'REVISADO': return 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800';
    case 'APROBADO': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'PENDIENTE_REVISION': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
    case 'RECHAZADO': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getSharingStatusColor = (status: SharingStatus) => {
  switch (status) {
    case 'ENVIADO': return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
    case 'ASIGNADO': return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getAssignmentStatusStyle = (status: string) => {
  switch (status) {
    case "pendiente": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
    case "visto": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "editado": return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
    case "completado": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "rechazado": return "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    case "revisado": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

const getAssignmentStatusIcon = (s: string) => {
  switch (s) {
    case "pendiente": return "schedule";
    case "visto": return "visibility";
    case "editado": return "edit_note";
    case "completado": return "check_circle";
    case "rechazado": return "cancel";
    case "revisado": return "fact_check";
    default: return "help";
  }
};

const getStatusButtonColor = (status: FileStatus, isSelected: boolean) => {
  if (!isSelected) return 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600';
  switch (status) {
    case 'ACTIVO': return 'bg-green-500 text-white ring-2 ring-green-200 dark:ring-green-900';
    case 'PENDIENTE': return 'bg-yellow-500 text-white ring-2 ring-yellow-200 dark:ring-yellow-900';
    case 'INACTIVO': return 'bg-slate-500 text-white ring-2 ring-slate-200 dark:ring-slate-600';
    default: return 'bg-gray-500 text-white';
  }
};

const getFileIcon = (type: string) => {
  switch (type) {
    case 'DOCX': return { icon: 'description', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'PDF': return { icon: 'picture_as_pdf', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    case 'XLSX': return { icon: 'table_view', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
    default: return { icon: 'article', color: 'bg-slate-100 text-slate-600' };
  }
}

const matchesSearch = (doc: Document, q: string) => {
  if (!q.trim()) return true;
  const term = q.trim().toLowerCase();
  return doc.name.toLowerCase().includes(term) || (doc.type && doc.type.toLowerCase().includes(term));
};

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenUploadModal: onOpenUploadModalProp,
  isUploadModalOpen = false,
  searchQuery: searchQueryProp = "",
  onOpenDocument,
}) => {
  // Obtener contexto del AppLayout (Outlet context)
  const layoutContext = useOutletContext<LayoutContext | undefined>();
  const onOpenUploadModal = onOpenUploadModalProp ?? layoutContext?.openUploadModal;
  const searchQuery = searchQueryProp || layoutContext?.searchQuery || "";

  const navigate = useNavigate();
  const {
    documents,
    loading,
    refresh: onRefresh,
    deleteDocument: handleDeleteDoc,
    updateStatus: onStatusChange,
  } = useDocuments();
  const [filter, setFilter] = useState<'TODOS' | 'ACTIVOS' | 'PENDIENTES' | 'VISTO' | 'EDITADO' | 'EXPIRADOS'>('TODOS');
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [assignDocument, setAssignDocument] = useState<Document | null>(null);
  const { user } = useAuth();
  const currentUserRole = user?.role ?? 'asistente';
  const [adminUnlockedForSession, setAdminUnlockedForSession] = useState(false);
  const [adminAccessDocument, setAdminAccessDocument] = useState<Document | null>(null);
  const [menuOpenDocId, setMenuOpenDocId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewSuperDocRef = useRef<SuperDoc | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    setConfirmDeleteDocId(null);
  }, [menuOpenDocId]);

  // ─── Full-window drag & drop ────────────────────────────────────────────
  const handleWindowDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes('Files') && !isUploadModalOpen) {
      setIsDraggingOver(true);
    }
  }, [isUploadModalOpen]);

  const handleWindowDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    }
  }, []);

  useEffect(() => {
    setPreviewUrl('');
    setPreviewBlob(null);
    setIsPreviewLoading(true);

    if (previewDoc) {
      if (previewDoc.type === 'DOCX') {
        const fetchContent = async () => {
          try {
            const token = await supabase.auth.getSession().then(({ data }) => data.session?.access_token);
            const baseUrl = getDocumentFileUrl(previewDoc.id);
            const res = await fetch(baseUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (res.ok) {
              const blob = await res.blob();
              setPreviewBlob(blob);
            } else {
              setPreviewHtml('<p class="text-red-500 font-bold p-4">Error al cargar la previsualización del documento.</p>');
            }
          } catch (error) {
            setPreviewHtml('<p class="text-red-500 font-bold p-4">Error de conexión al obtener el archivo.</p>');
          } finally {
            setIsPreviewLoading(false);
          }
        };
        fetchContent();
      } else {
        supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token;
          const baseUrl = getDocumentFileUrl(previewDoc.id);
          setPreviewUrl(token ? `${baseUrl}?token=${token}` : baseUrl);
          setIsPreviewLoading(false);
        });
      }
    } else {
      setIsPreviewLoading(false);
    }
  }, [previewDoc]);

  // Mount/Unmount SuperDoc once the blob is ready and container exists
  useEffect(() => {
    if (!previewBlob || !previewContainerRef.current || previewDoc?.type !== 'DOCX') return;

    let destroyed = false;
    try {
      if (previewSuperDocRef.current) {
        previewSuperDocRef.current.destroy();
        previewSuperDocRef.current = null;
      }

      const config: any = {
        selector: previewContainerRef.current,
        document: previewBlob,
        user: { name: user?.name || 'Invitado', email: user?.email || 'invitado@abogadosoft.com' },
        documentMode: 'viewing',
        viewOptions: { layout: 'web' },
        onReady: () => {
          if (destroyed) return;
        },
        onException: ({ error }: { error: Error }) => {
          console.error("SuperDoc Preview Error:", error);
        }
      };

      previewSuperDocRef.current = new SuperDoc(config);
    } catch (e) {
      console.error("SuperDoc Initialization failed", e);
    }

    return () => {
      destroyed = true;
      if (previewSuperDocRef.current) {
        previewSuperDocRef.current.destroy();
        previewSuperDocRef.current = null;
      }
    };
  }, [previewBlob, previewContainerRef, previewDoc, user]);

  const handleWindowDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleWindowDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (e.dataTransfer?.files.length) {
      const files = Array.from(e.dataTransfer.files);
      onOpenUploadModal?.(files);
    }
  }, [onOpenUploadModal]);

  useEffect(() => {
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleWindowDragEnter, handleWindowDragLeave, handleWindowDragOver, handleWindowDrop]);

  useEffect(() => {
    if (!menuOpenDocId) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuAnchorRef.current && !menuAnchorRef.current.contains(target)) {
        setMenuOpenDocId(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuOpenDocId]);

  const showAccesoCompleto = currentUserRole === "asistente" && !adminUnlockedForSession;

  const handleAccesoCompleto = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setAdminAccessDocument(doc);
  };

  const handleAdminAccessSuccess = () => {
    setAdminUnlockedForSession(true);
    setAdminAccessDocument(null);
  };

  const handleStatusChange = async (e: React.MouseEvent, id: string, newFileStatus: FileStatus) => {
    e.stopPropagation();
    try {
      await onStatusChange(id, newFileStatus);
    } catch (err) {
      console.error('Error cambiando estado:', err);
    }
  };

  const handleArchive = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    const nextStatus: FileStatus = doc.fileStatus === "INACTIVO" ? "ACTIVO" : "INACTIVO";
    try {
      await onStatusChange(doc.id, nextStatus);
    } catch (err) {
      console.error('Error archivando:', err);
    }
  };

  const handleDelete = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (confirmDeleteDocId === doc.id) {
      setMenuOpenDocId(null);
      setConfirmDeleteDocId(null);
      handleDeleteDoc(doc.id);
    } else {
      setConfirmDeleteDocId(doc.id);
    }
  };

  const [permissionsDocument, setPermissionsDocument] = useState<Document | null>(null);

  const handlePermissions = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    setPermissionsDocument(doc);
  };

  const handleDocumentClick = (doc: Document) => {
    if (onOpenDocument) {
      onOpenDocument(doc.id, doc.type);
    } else if (doc.type === 'XLSX') {
      navigate(`/documento/${doc.id}`);
    } else {
      navigate(`/documento/${doc.id}`);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (!matchesSearch(doc, searchQuery)) return false;
    if (filter === 'TODOS') return true;
    if (filter === 'ACTIVOS') return doc.fileStatus === 'ACTIVO';
    if (filter === 'PENDIENTES') return doc.fileStatus === 'PENDIENTE';
    if (filter === 'VISTO') return doc.collaborationStatus === 'VISTO';
    if (filter === 'EDITADO') return doc.collaborationStatus === 'EDITADO';
    if (filter === 'EXPIRADOS') return doc.fileStatus === 'INACTIVO';
    return true;
  });

  const counts = {
    todos: documents.length,
    activos: documents.filter(d => d.fileStatus === 'ACTIVO').length,
    pendientes: documents.filter(d => d.fileStatus === 'PENDIENTE').length,
    visto: documents.filter(d => d.collaborationStatus === 'VISTO').length,
    editado: documents.filter(d => d.collaborationStatus === 'EDITADO').length,
    expirados: documents.filter(d => d.fileStatus === 'INACTIVO').length
  };

  return (
    <>
      {/* Full-window drag overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary pointer-events-none animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-10 rounded-3xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border-2 border-primary">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-primary animate-bounce">cloud_upload</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">Suelta el archivo aquí</p>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Se abrirá el modal de subida para adjuntar tu documento</p>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {/* Welcome & Despacho Hero */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-black tracking-tight dark:text-white">Bienvenido, {user?.name ?? 'Usuario'}</h2>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-lg font-medium">Resumen general de su despacho legal al día de hoy.</p>
          </div>

          {/* Card de Despacho (Equipo) Reposicionada */}
          {user?.groupMemberships && user.groupMemberships.length > 0 && (
            <Link
              to="/equipo"
              className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm p-4 flex flex-row items-center gap-4 shrink-0 transition-all hover:border-primary/40 hover:shadow-md cursor-pointer group text-left max-w-sm w-full lg:w-auto outline-none focus-visible:border-primary"
              title="Ver opciones de equipo"
            >
              <div className="bg-primary/10 text-primary w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">groups</span>
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-lg font-extrabold text-[#111318] dark:text-white truncate">
                  {user.groupMemberships[0].group.name}
                </h3>
                {user.groupMemberships[0].group.description && (
                  <p className="text-sm font-semibold text-[#616f89] dark:text-slate-400 truncate mt-0.5">
                    {user.groupMemberships[0].group.description}
                  </p>
                )}
              </div>
              <div
                className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-[#616f89] dark:text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
              </div>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos Activos</p>
              <span className="material-symbols-outlined text-green-500">verified</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-3xl font-bold dark:text-white">{counts.activos}</p>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Estado de archivo</p>
            </div>
            {counts.todos > 0 && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(counts.activos / counts.todos) * 100}%` }}></div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Pendientes</p>
              <span className="material-symbols-outlined text-yellow-500">pending</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-3xl font-bold dark:text-white">{counts.pendientes}</p>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Por revisar</p>
            </div>
            {counts.todos > 0 && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${(counts.pendientes / counts.todos) * 100}%` }}></div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Expirados</p>
              <span className="material-symbols-outlined text-red-500">error</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-3xl font-bold dark:text-white">{counts.expirados}</p>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Estado de archivo</p>
            </div>
            {counts.todos > 0 && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(counts.expirados / counts.todos) * 100}%` }}></div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos Guardados</p>
              <span className="material-symbols-outlined text-primary">description</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold dark:text-white">{counts.todos}</p>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Total en lista</p>
            </div>
          </div>
        </div>

        {/* Team card moved to the top header group */}

        <div className="pt-4">
          <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
            <span className="material-symbols-outlined text-primary">history</span>
            Mis Documentos Recientes
          </h3>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-4 flex-wrap overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('TODOS')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm transition-all whitespace-nowrap ${filter === 'TODOS' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className="material-symbols-outlined text-xl">check_circle</span>
            Todos ({counts.todos})
          </button>
          <button
            onClick={() => setFilter('ACTIVOS')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold transition-all shadow-sm whitespace-nowrap ${filter === 'ACTIVOS' ? 'bg-primary text-white border-2 border-primary' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className={`material-symbols-outlined text-xl ${filter === 'ACTIVOS' ? 'text-white' : 'text-green-600'}`}>verified</span>
            Activos ({counts.activos})
          </button>
          <button
            onClick={() => setFilter('PENDIENTES')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold transition-all shadow-sm whitespace-nowrap ${filter === 'PENDIENTES' ? 'bg-primary text-white border-2 border-primary' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className={`material-symbols-outlined text-xl ${filter === 'PENDIENTES' ? 'text-white' : 'text-orange-600'}`}>pending</span>
            Pendientes ({counts.pendientes})
          </button>
          <button
            onClick={() => setFilter('VISTO')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold transition-all shadow-sm whitespace-nowrap ${filter === 'VISTO' ? 'bg-primary text-white border-2 border-primary' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className={`material-symbols-outlined text-xl ${filter === 'VISTO' ? 'text-white' : 'text-blue-600'}`}>visibility</span>
            Visto ({counts.visto})
          </button>
          <button
            onClick={() => setFilter('EDITADO')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold transition-all shadow-sm whitespace-nowrap ${filter === 'EDITADO' ? 'bg-primary text-white border-2 border-primary' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className={`material-symbols-outlined text-xl ${filter === 'EDITADO' ? 'text-white' : 'text-purple-600'}`}>edit_document</span>
            Editado ({counts.editado})
          </button>
          <button
            onClick={() => setFilter('EXPIRADOS')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold transition-all shadow-sm whitespace-nowrap ${filter === 'EXPIRADOS' ? 'bg-primary text-white border-2 border-primary' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary'}`}
          >
            <span className={`material-symbols-outlined text-xl ${filter === 'EXPIRADOS' ? 'text-white' : 'text-red-600'}`}>error</span>
            Expirados ({counts.expirados})
          </button>
        </div>

        {searchQuery.trim() && filteredDocuments.length === 0 && (
          <p className="text-[#616f89] dark:text-[#a0aec0] text-center py-8 text-lg font-medium">
            Sin resultados de búsqueda
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 animate-pulse min-h-[300px]">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                  <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded-md" />
                </div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="Lista de documentos recientes">
            {filteredDocuments.map((doc) => {
              const { icon, color } = getFileIcon(doc.type);
              const isExpiring = doc.fileStatus === 'PENDIENTE' && doc.expirationDate;

              return (
                <article
                  key={doc.id}
                  role="listitem"
                  onClick={() => handleDocumentClick(doc)}
                  className="min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all cursor-pointer group shadow-sm relative flex flex-col h-full"
                >
                  <header className="flex items-start justify-between gap-3 mb-4">
                    <div className={`p-4 ${color} rounded-xl shrink-0`} aria-hidden>
                      <span className="material-symbols-outlined text-[32px] font-bold">{icon}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end shrink-0 items-center">
                      <span className={`px-2.5 py-1.5 rounded-md text-[10px] items-center gap-1 font-black uppercase border flex ${getFileStatusColor(doc.fileStatus)}`}>
                        <span className="material-symbols-outlined text-[12px]" aria-hidden>
                          {doc.fileStatus === 'ACTIVO' ? 'verified' : doc.fileStatus === 'PENDIENTE' ? 'pending' : 'error'}
                        </span>
                        {doc.fileStatus}
                      </span>
                      {doc.collaborationStatus && (
                        <span className={`px-2.5 py-1.5 rounded-md text-[10px] items-center gap-1 font-black uppercase border flex ${getCollaborationStatusColor(doc.collaborationStatus)}`}>
                          <span className="material-symbols-outlined text-[12px]" aria-hidden>
                            {doc.collaborationStatus === 'VISTO' ? 'visibility' : doc.collaborationStatus === 'EDITADO' ? 'edit_document' : 'group'}
                          </span>
                          {doc.collaborationStatus}
                        </span>
                      )}
                      <div className="relative" ref={menuOpenDocId === doc.id ? menuAnchorRef : undefined}>
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-full p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                            className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-slate-500 hover:text-primary dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            aria-label="Vista Rápida"
                            title="Previsualizar"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpenDocId(menuOpenDocId === doc.id ? null : doc.id); }}
                            className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            aria-label="Más opciones"
                            aria-expanded={menuOpenDocId === doc.id}
                            aria-haspopup="true"
                          >
                            <span className="flex flex-col items-center gap-0.5" aria-hidden>
                              <span className="w-1 h-1 rounded-full bg-current" />
                              <span className="w-1 h-1 rounded-full bg-current" />
                              <span className="w-1 h-1 rounded-full bg-current" />
                            </span>
                          </button>
                        </div>
                        {menuOpenDocId === doc.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg"
                            role="menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Opciones de Estado en el Menú de 3 Puntos */}
                            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Estado</p>
                              <div className="flex items-center flex-wrap gap-1.5">
                                {(['ACTIVO', 'PENDIENTE', 'INACTIVO'] as FileStatus[]).map((status) => (
                                  <button
                                    key={status}
                                    onClick={(e) => { setMenuOpenDocId(null); handleStatusChange(e, doc.id, status); }}
                                    title={`Marcar como ${status}`}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${getStatusButtonColor(status, doc.fileStatus === status)}`}
                                  >
                                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                                      {status === 'ACTIVO' && 'check'}
                                      {status === 'PENDIENTE' && 'hourglass_empty'}
                                      {status === 'INACTIVO' && 'block'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => handleArchive(e, doc)}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-lg">
                                {doc.fileStatus === "INACTIVO" ? "unarchive" : "archive"}
                              </span>
                              {doc.fileStatus === "INACTIVO" ? "Desarchivar" : "Archivar"}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => { e.stopPropagation(); setMenuOpenDocId(null); setShareDocument(doc); }}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-lg">share</span>
                              Compartir
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => { e.stopPropagation(); setMenuOpenDocId(null); setAssignDocument(doc); }}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-lg">person_add</span>
                              Asignar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setMenuOpenDocId(null); handleAccesoCompleto(e, doc); }}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-lg">
                                {currentUserRole === 'admin' ? 'key' : 'lock_open'}
                              </span>
                              {currentUserRole === 'admin' ? 'Generar PIN de acceso' : 'Pedir acceso completo'}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => handlePermissions(e, doc)}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-lg">shield</span>
                              Permisos
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => handleDelete(e, doc)}
                              className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-b-lg"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                              {confirmDeleteDocId === doc.id ? "Clic para confirmar" : "Eliminar"}
                            </button>
                          </div>
                        )}

                        {/* QUICK PREVIEW POPOVER */}
                        {previewDoc?.id === doc.id && (
                          <>
                            {/* Backdrop to close */}
                            <div className="fixed inset-0 z-[55]" onClick={(e) => { e.stopPropagation(); setPreviewDoc(null); }} />
                            <div
                              className="absolute right-0 top-full mt-2 w-[360px] sm:w-[420px] h-[500px] z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden cursor-default animate-in fade-in zoom-in-95 origin-top-right"
                              onClick={e => e.stopPropagation()}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between p-2.5 px-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center ${getFileIcon(previewDoc.type).color}`}>
                                    <span className="material-symbols-outlined text-base font-bold">{getFileIcon(previewDoc.type).icon}</span>
                                  </div>
                                  <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">{previewDoc.name}</h3>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPreviewDoc(null); handleDocumentClick(previewDoc); }}
                                    className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded-md transition-colors"
                                    title="Abrir Completo"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPreviewDoc(null); }}
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                    title="Cerrar"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                              </div>
                              {/* Content */}
                              <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                                {isPreviewLoading ? (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2"></div>
                                    <p className="text-gray-400 text-[10px] font-bold">Cargando...</p>
                                  </div>
                                ) : previewBlob && previewDoc.type === 'DOCX' ? (
                                  <div className="flex justify-center w-full">
                                    <div style={{ width: '850px', transform: 'scale(0.47)', transformOrigin: 'top center', height: 0 }}>
                                      <div ref={previewContainerRef} className="superdoc-container" style={{ width: '850px', minHeight: '1800px' }} />
                                    </div>
                                  </div>
                                ) : previewUrl ? (
                                  <iframe
                                    src={previewUrl}
                                    className="w-full h-full border-none bg-white"
                                    title={`Previsualización de ${previewDoc.name}`}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">description</span>
                                    <p className="text-slate-400 text-[10px] font-medium">No disponible</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </header>

                  <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                    {doc.name.split('_').map((part, i) =>
                      i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                    )}
                  </h3>

                  <div className="flex flex-col gap-1.5 mb-3">
                    <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                      <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden>calendar_today</span>
                      <span>{doc.lastModified}</span>
                    </p>
                    {doc.lastEditor && (
                      <p className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-medium text-[13px]">
                        <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden>edit</span>
                        <span className="truncate">Editado por: {doc.lastEditor}</span>
                      </p>
                    )}
                  </div>

                  {isExpiring && (
                    <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-100 dark:border-red-900/50" role="alert">
                      <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>warning</span>
                      <span className="text-xs font-bold">Vence el {doc.expirationDate}</span>
                    </div>
                  )}

                  <footer
                    className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2"
                  >
                    {doc.sharingStatus && (
                      <span className={`px-2 py-1 rounded-md text-[10px] items-center gap-1 font-black uppercase border flex ${getSharingStatusColor(doc.sharingStatus)}`}>
                        <span className="material-symbols-outlined text-[12px]" aria-hidden></span>
                        {doc.sharingStatus}
                      </span>
                    )}
                    {doc.assignments && doc.assignments.length > 0 && (
                      <div className="flex gap-2 items-center flex-wrap">
                        {doc.assignments.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1 pr-2 rounded-full border border-slate-200 dark:border-slate-700/50">
                            {a.assignee.avatarUrl ? (
                              <img src={a.assignee.avatarUrl} alt={a.assignee.name} title={`Asignado a: ${a.assignee.name}`} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                              <div title={`Asignado a: ${a.assignee.name}`} className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                {a.assignee.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 border ${getAssignmentStatusStyle(a.status)}`} title={`Estado: ${a.status}`}>
                              <span className="material-symbols-outlined text-[10px]" aria-hidden>{getAssignmentStatusIcon(a.status)}</span>
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(doc.currentUserPermission !== undefined || (doc.documentPermissions?.length ?? 0) > 0) && (
                      <span className="px-2 py-1 rounded-md text-[10px] items-center gap-1 font-black uppercase border flex bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                        <span className="material-symbols-outlined text-[14px]">shield</span>
                        {doc.currentUserPermission !== undefined ? `Tú: ${permissionLabel[doc.currentUserPermission]} ` : 'Permisos'}
                      </span>
                    )}
                    {doc.documentPermissions && doc.documentPermissions.some((p) => p.level === "admin" && p.userName !== "Tú") && (
                      <span className="px-2 py-1 rounded-md text-[10px] items-center gap-1 font-black uppercase border flex bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                        <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
                        Admin
                      </span>
                    )}
                  </footer>
                </article>
              );
            })}

            {/* Add New Card */}
            <div
              onClick={() => onOpenUploadModal?.()}
              className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[300px]"
            >
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-4xl">add</span>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-600 dark:text-slate-400">
                  Nuevo Documento
                </p>
                <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
                  Subir archivo
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {shareDocument && (
        <ShareModal
          document={shareDocument}
          onClose={() => setShareDocument(null)}
        />
      )}

      {assignDocument && (
        <AssignModal
          document={assignDocument}
          onClose={() => {
            setAssignDocument(null);
            onRefresh();
          }}
        />
      )}

      {adminAccessDocument && (
        <AdminAccessModal
          documentId={adminAccessDocument.id}
          documentName={adminAccessDocument.name}
          onClose={() => setAdminAccessDocument(null)}
          onSuccess={() => {
            handleAdminAccessSuccess();
            onRefresh();
          }}
        />
      )}

      {permissionsDocument && (
        <DocumentPermissionsModal
          document={permissionsDocument}
          onClose={() => setPermissionsDocument(null)}
          onSave={() => {
            setPermissionsDocument(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
};