import React, { useState, useRef, useEffect } from "react";
import { ViewState, Document, FileStatus, CollaborationStatus, SharingStatus, DocumentPermissionLevel } from "../types";
import { ShareModal } from "./ShareModal";
import { AdminAccessModal } from "./AdminAccessModal";
import { DocumentPermissionsModal } from "./DocumentPermissionsModal";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";

interface DashboardProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  onDeleteDocument: (doc: Document) => void;
  onNavigate: (view: ViewState) => void;
  onOpenUploadModal?: () => void;
  searchQuery?: string;
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
  documents,
  setDocuments,
  onDeleteDocument,
  onNavigate,
  onOpenUploadModal,
  searchQuery = "",
}) => {
  const [filter, setFilter] = useState<'TODOS' | 'ACTIVOS' | 'PENDIENTES' | 'VISTO' | 'EDITADO' | 'EXPIRADOS'>('TODOS');
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const { user } = useAuth();
  const currentUserRole = user?.role ?? 'asistente';
  const [adminUnlockedForSession, setAdminUnlockedForSession] = useState(false);
  const [adminAccessDocument, setAdminAccessDocument] = useState<Document | null>(null);
  const [menuOpenDocId, setMenuOpenDocId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConfirmDeleteDocId(null);
  }, [menuOpenDocId]);

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

  const handleStatusChange = (e: React.MouseEvent, id: string, newFileStatus: FileStatus) => {
    e.stopPropagation();
    setDocuments(docs => docs.map(doc =>
        doc.id === id ? { ...doc, fileStatus: newFileStatus } : doc
    ));
  };

  const handleArchive = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    const nextStatus: FileStatus = doc.fileStatus === "INACTIVO" ? "ACTIVO" : "INACTIVO";
    setDocuments(docs => docs.map(d =>
      d.id === doc.id ? { ...d, fileStatus: nextStatus } : d
    ));
  };

  const handleDelete = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (confirmDeleteDocId === doc.id) {
      setMenuOpenDocId(null);
      setConfirmDeleteDocId(null);
      onDeleteDocument(doc);
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
    if (doc.type === 'XLSX') {
        onNavigate(ViewState.EXCEL_EDITOR);
    } else {
        onNavigate(ViewState.EDITOR);
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
      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {/* Welcome Heading */}
        <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-black tracking-tight dark:text-white">Bienvenido, {user?.name ?? 'Usuario'}</h2>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Resumen general de su despacho legal al día de hoy.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos Activos</p>
                    <span className="material-symbols-outlined text-primary">verified</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">{counts.activos}</p>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Estado de archivo</p>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Pendientes</p>
                    <span className="material-symbols-outlined text-primary">pending</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">{counts.pendientes}</p>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Por revisar</p>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Expirados</p>
                    <span className="material-symbols-outlined text-primary">error</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">{counts.expirados}</p>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Estado de archivo</p>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
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

        {/* Su Equipo de Trabajo */}
        {user?.groupMemberships && user.groupMemberships.length > 0 && (
          <section className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary p-3 rounded-xl">
                  <span className="material-symbols-outlined text-2xl">groups</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold dark:text-white">
                    {user.groupMemberships[0].group.name}
                  </h3>
                  {user.groupMemberships[0].group.description && (
                    <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-0.5">
                      {user.groupMemberships[0].group.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(ViewState.SECURITY)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#616f89] dark:text-[#a0aec0] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Ver equipo
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </section>
        )}

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
                    <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase border ${getFileStatusColor(doc.fileStatus)}`}>
                      {doc.fileStatus}
                    </span>
                    {doc.collaborationStatus && (
                      <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase border ${getCollaborationStatusColor(doc.collaborationStatus)}`}>
                        {doc.collaborationStatus}
                      </span>
                    )}
                    <div className="relative" ref={menuOpenDocId === doc.id ? menuAnchorRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuOpenDocId(menuOpenDocId === doc.id ? null : doc.id); }}
                        className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                      {menuOpenDocId === doc.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg"
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => handleArchive(e, doc)}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-lg"
                          >
                            <span className="material-symbols-outlined text-lg">
                              {doc.fileStatus === "INACTIVO" ? "unarchive" : "archive"}
                            </span>
                            {doc.fileStatus === "INACTIVO" ? "Desarchivar" : "Archivar"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => handlePermissions(e, doc)}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-lg"
                          >
                            <span className="material-symbols-outlined text-lg">shield</span>
                            Permisos
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => handleDelete(e, doc)}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-lg"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            {confirmDeleteDocId === doc.id ? "Clic para confirmar" : "Eliminar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </header>

                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white break-normal leading-tight flex-grow min-w-0">
                  {doc.name.split('_').map((part, i) =>
                    i === 0 ? part : <React.Fragment key={i}><wbr />_{part}</React.Fragment>
                  )}
                </h3>

                <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm mb-3">
                  <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>calendar_today</span>
                  <span>{doc.lastModified}</span>
                </p>

                {isExpiring && (
                  <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-lg border border-red-100 dark:border-red-900/50" role="alert">
                    <span className="material-symbols-outlined text-lg shrink-0" aria-hidden>warning</span>
                    <span className="text-xs font-bold">Vence el {doc.expirationDate}</span>
                  </div>
                )}

                <footer
                  className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 cursor-default flex flex-col gap-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <section aria-label="Estado del documento">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Estado</p>
                    <div className="flex flex-wrap gap-2">
                      {(['ACTIVO', 'PENDIENTE', 'INACTIVO'] as FileStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={(e) => handleStatusChange(e, doc.id, status)}
                          title={`Marcar como ${status}`}
                          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-all shadow-sm ${getStatusButtonColor(status, doc.fileStatus === status)}`}
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden>
                            {status === 'ACTIVO' && 'check'}
                            {status === 'PENDIENTE' && 'hourglass_empty'}
                            {status === 'INACTIVO' && 'block'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  {doc.sharingStatus && (
                    <div className="flex items-center gap-2" aria-label="Compartido">
                      <span className="material-symbols-outlined text-lg text-slate-400" aria-hidden>share</span>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${getSharingStatusColor(doc.sharingStatus)}`}>
                        {doc.sharingStatus}
                      </span>
                    </div>
                  )}
                  {(doc.currentUserPermission !== undefined || (doc.documentPermissions?.length ?? 0) > 0) && (
                    <div className="flex items-center gap-2 flex-wrap" aria-label="Permisos">
                      <span className="material-symbols-outlined text-lg text-slate-400" aria-hidden>shield</span>
                      {doc.currentUserPermission !== undefined && (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                          Tú: {permissionLabel[doc.currentUserPermission]}
                        </span>
                      )}
                      {doc.documentPermissions && doc.documentPermissions.some((p) => p.level === "admin" && p.userName !== "Tú") && (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                          Admin
                        </span>
                      )}
                    </div>
                  )}
                  {showAccesoCompleto && doc.currentUserPermission !== "admin" && (
                    <button
                      type="button"
                      onClick={(e) => handleAccesoCompleto(e, doc)}
                      className="w-full min-h-[44px] py-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden>lock_open</span>
                      Acceso completo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShareDocument(doc); }}
                    className="w-full min-h-[44px] py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden>share</span>
                    Compartir
                  </button>
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

      </main>

      {shareDocument && (
        <ShareModal document={shareDocument} onClose={() => setShareDocument(null)} />
      )}
      {adminAccessDocument && (
        <AdminAccessModal
          documentName={adminAccessDocument.name}
          onClose={() => setAdminAccessDocument(null)}
          onSuccess={handleAdminAccessSuccess}
        />
      )}
      {permissionsDocument && (
        <DocumentPermissionsModal
          document={permissionsDocument}
          onClose={() => setPermissionsDocument(null)}
          onSave={(permissions) => {
            if (!permissionsDocument) return;
            setDocuments((docs) =>
              docs.map((doc) =>
                doc.id === permissionsDocument.id ? { ...doc, documentPermissions: permissions } : doc
              )
            );
          }}
        />
      )}
    </>
  );
};