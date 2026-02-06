import React, { useState } from "react";
import { ViewState, Document, DocumentStatus } from "../types";

interface DashboardProps {
  onNavigate: (view: ViewState) => void;
}

// Mock data for the dashboard with statuses
const initialDocuments: Document[] = [
  {
    id: "1",
    name: "Contrato_Docente_Titular_2024.docx",
    type: "DOCX",
    lastModified: "Hace 2 horas",
    timeAgo: "2h",
    status: "ACTIVO",
    expirationDate: "2024-12-31"
  },
  {
    id: "2",
    name: "Resolucion_Rectoral_N045.pdf",
    type: "PDF",
    lastModified: "Ayer, 14:00",
    timeAgo: "1d",
    status: "VISTO"
  },
  {
    id: "3",
    name: "Presupuesto_Facultad_Derecho.xlsx",
    type: "XLSX",
    lastModified: "15 Oct 2024",
    timeAgo: "1w",
    status: "EDITADO"
  },
  {
    id: "4",
    name: "Convenio_Marco_Interinstitucional.pdf",
    type: "PDF",
    lastModified: "10 Oct 2024",
    timeAgo: "2w",
    status: "PENDIENTE",
    expirationDate: "2024-10-30" // Near expiration
  },
  {
    id: "5",
    name: "Acta_Comite_Etica_Antigua.docx",
    type: "DOCX",
    lastModified: "20 Sep 2023",
    timeAgo: "1y",
    status: "INACTIVO"
  }
];

const getStatusColor = (status?: DocumentStatus) => {
  switch (status) {
    case 'ACTIVO': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'INACTIVO': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600';
    case 'VISTO': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'EDITADO': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

// Colors for the selection buttons
const getStatusButtonColor = (status: DocumentStatus, isSelected: boolean) => {
    if (!isSelected) return 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600';
    
    switch (status) {
      case 'ACTIVO': return 'bg-green-500 text-white ring-2 ring-green-200 dark:ring-green-900';
      case 'PENDIENTE': return 'bg-yellow-500 text-white ring-2 ring-yellow-200 dark:ring-yellow-900';
      case 'INACTIVO': return 'bg-slate-500 text-white ring-2 ring-slate-200 dark:ring-slate-600';
      case 'VISTO': return 'bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-900';
      case 'EDITADO': return 'bg-purple-500 text-white ring-2 ring-purple-200 dark:ring-purple-900';
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

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [filter, setFilter] = useState<'TODOS' | 'ACTIVOS' | 'PENDIENTES' | 'VISTO' | 'EDITADO' | 'EXPIRADOS'>('TODOS');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUploadAndSave = () => {
    if (!selectedFile) return;
    onNavigate(ViewState.EDITOR);
    setIsUploadModalOpen(false);
  };

  const handleStatusChange = (e: React.MouseEvent, id: string, newStatus: DocumentStatus) => {
    e.stopPropagation();
    setDocuments(docs => docs.map(doc => 
        doc.id === id ? { ...doc, status: newStatus } : doc
    ));
  };

  const handleDocumentClick = (doc: Document) => {
    if (doc.type === 'XLSX') {
        onNavigate(ViewState.EXCEL_EDITOR);
    } else {
        onNavigate(ViewState.EDITOR);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'TODOS') return true;
    if (filter === 'ACTIVOS') return doc.status === 'ACTIVO';
    if (filter === 'PENDIENTES') return doc.status === 'PENDIENTE';
    if (filter === 'VISTO') return doc.status === 'VISTO';
    if (filter === 'EDITADO') return doc.status === 'EDITADO';
    if (filter === 'EXPIRADOS') return doc.status === 'INACTIVO'; 
    return true;
  });

  // Calculate counts for pills
  const counts = {
    todos: documents.length,
    activos: documents.filter(d => d.status === 'ACTIVO').length,
    pendientes: documents.filter(d => d.status === 'PENDIENTE').length,
    visto: documents.filter(d => d.status === 'VISTO').length,
    editado: documents.filter(d => d.status === 'EDITADO').length,
    expirados: documents.filter(d => d.status === 'INACTIVO').length
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#111318] dark:text-white">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-[#1a212f] border-b border-[#dbdfe6] dark:border-[#2d3748] sticky top-0 z-50">
        <div className="flex items-center gap-4 flex-1 max-w-4xl">
          {/* Internal Navigation (Replaces Sidebar) */}
          <div className="flex items-center gap-2 mr-6 cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>
             <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-xl">balance</span>
             </div>
             <h1 className="text-[#111318] dark:text-white text-lg font-bold leading-none hidden md:block">AbogadoSoft</h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            <button 
                onClick={() => onNavigate(ViewState.DASHBOARD)} 
                className="px-3 py-2 text-sm font-bold text-primary bg-primary/10 rounded-lg"
            >
                Inicio
            </button>
            <button 
                onClick={() => onNavigate(ViewState.AGREEMENTS)} 
                className="px-3 py-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
                Convenios
            </button>
            <button 
                onClick={() => onNavigate(ViewState.ACTIVITY_LOG)}
                className="px-3 py-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
                Bitácora
            </button>
             <button 
                onClick={() => onNavigate(ViewState.SECURITY)}
                className="px-3 py-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
                Seguridad
            </button>
          </nav>

          <div className="relative w-full max-w-xs lg:max-w-md hidden sm:block ml-4">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#616f89]">
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-background-light dark:bg-[#101622] border-none rounded-lg focus:ring-2 focus:ring-primary text-sm placeholder:text-[#616f89]"
              placeholder="Buscar..."
              type="text"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 bg-background-light dark:bg-gray-800 px-3 py-2 rounded-lg text-[#111318] dark:text-white text-sm font-semibold border border-[#dbdfe6] dark:border-[#2d3748] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span className="hidden sm:inline">Subir</span>
          </button>
          <div className="h-8 w-[1px] bg-[#dbdfe6] dark:bg-[#2d3748] mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none">Lic. García</p>
              <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">Socio Principal</p>
            </div>
            <div
              className="size-10 rounded-full bg-cover bg-center border-2 border-white dark:border-[#2d3748] shadow-sm"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBSEfFZcc_w3SK5PnsmL4V30yNO8DpfFSCE3e9TlZGhdLVKq2pXoIg2G4L9Aw8pWUrPdcc3my5bSeGAVfXn9hdQYTdo1yEOR8kk302aNv10W1OyNWq8gtNrsiJYB09GxaAjG349kRgcX6XBV3UukeJ8d5-0-fgRjPQyXWnLxDNjQm18FMJrBQIFxEeoB5kgucZrfcstA9N5utnSBvsvdxS2k8vQMqxYR1dMxbCznoBfWTs0Ip__onKXnjGz7lPaqY5OjalPIrHhQhM")',
              }}
            ></div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {/* Welcome Heading */}
        <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-black tracking-tight dark:text-white">Bienvenido, Lic. García</h2>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">Resumen general de su despacho legal al día de hoy.</p>
        </div>

        {/* Stats Grid - Kept from new design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Clientes Activos</p>
                    <span className="material-symbols-outlined text-primary">groups</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">124</p>
                    <p className="text-[#07883b] text-sm font-bold">+5% este mes</p>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Expedientes en Curso</p>
                    <span className="material-symbols-outlined text-primary">work</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">45</p>
                    <p className="text-[#07883b] text-sm font-bold">+2% este mes</p>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1a212f] p-6 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Documentos Guardados</p>
                    <span className="material-symbols-outlined text-primary">description</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold dark:text-white">1,082</p>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm font-medium">Total histórico</p>
                </div>
            </div>
        </div>

        {/* Section Header for Documents with Excel Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pt-4 gap-4">
          <h3 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
            <span className="material-symbols-outlined text-primary">
              history
            </span>
            Mis Documentos Recientes
          </h3>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a212f] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-lg">upload_file</span>
                Importar
             </button>
             <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-lg">table_view</span>
                Exportar Excel
             </button>
             <button className="text-primary font-bold hover:underline text-sm ml-2">
                Ver todos
             </button>
          </div>
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

        {/* Reverted Document Grid Style with New Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const { icon, color } = getFileIcon(doc.type);
            const isExpiring = doc.status === 'PENDIENTE' && doc.expirationDate;
            
            return (
              <div 
                key={doc.id} 
                onClick={() => handleDocumentClick(doc)}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all cursor-pointer group shadow-sm relative flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-4 ${color} rounded-xl`}>
                    <span className="material-symbols-outlined text-[32px] font-bold">
                      {icon}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                  </div>
                </div>
                
                <h4 className="text-xl font-extrabold mb-2 text-slate-900 dark:text-white line-clamp-2 leading-tight flex-grow">
                  {doc.name}
                </h4>
                
                <div className="flex items-center justify-between mt-3 mb-4">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                      <span className="material-symbols-outlined text-base">
                        calendar_today
                      </span>
                      <span>{doc.lastModified}</span>
                    </div>
                </div>

                {isExpiring && (
                     <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        <span className="text-xs font-bold">Vence el {doc.expirationDate}</span>
                     </div>
                )}

                <div 
                    className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cambiar estado</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 mb-4">
                         {(['ACTIVO', 'PENDIENTE', 'VISTO', 'EDITADO', 'INACTIVO'] as DocumentStatus[]).map((status) => (
                            <button
                                key={status}
                                onClick={(e) => handleStatusChange(e, doc.id, status)}
                                title={`Marcar como ${status}`}
                                className={`size-8 rounded-full flex items-center justify-center transition-all shadow-sm ${getStatusButtonColor(status, doc.status === status)}`}
                            >
                                <span className="material-symbols-outlined text-base">
                                    {status === 'ACTIVO' && 'check'}
                                    {status === 'PENDIENTE' && 'hourglass_empty'}
                                    {status === 'VISTO' && 'visibility'}
                                    {status === 'EDITADO' && 'edit'}
                                    {status === 'INACTIVO' && 'block'}
                                </span>
                            </button>
                         ))}
                    </div>
                    <button className="w-full py-2.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-lg">share</span>
                        Compartir
                    </button>
                </div>
              </div>
            );
          })}

          {/* Add New Card */}
          <div 
             onClick={() => onNavigate(ViewState.EDITOR)}
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
                Crear desde plantilla o subir archivo
              </p>
            </div>
          </div>
        </div>

      </main>

      <footer className="mt-20 border-t border-[#dbdfe6] dark:border-[#2d3748] py-8 px-6 text-center text-[#616f89] dark:text-[#a0aec0]">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-sm font-bold mb-1">
            AbogadoSoft v2.5
          </p>
          <p className="text-sm">
            © 2024 Despacho Jurídico
          </p>
        </div>
      </footer>

      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUploadModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 pb-4 text-center">
              <h2 className="text-3xl font-bold text-[#111318] dark:text-white">Agregar Nuevo Documento</h2>
              <p className="text-[#616f89] dark:text-[#a0aec0] mt-2 text-lg">
                Seleccione el archivo que desea guardar en el sistema legal.
              </p>
            </div>
            <div className="px-8 py-6">
              <label className="group relative border-4 border-dashed border-[#dbdfe6] dark:border-[#2d3748] rounded-2xl p-12 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#101622] hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <input
                  accept=".doc,.docx,.pdf,.xls,.xlsx,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                />
                <div className="bg-primary/10 text-primary p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-6xl">cloud_upload</span>
                </div>
                <p className="text-xl font-semibold text-[#111318] dark:text-white text-center">
                  Arrastre aquí su archivo o haga clic para buscar
                </p>
                <p className="text-[#616f89] dark:text-[#a0aec0] mt-4 text-sm font-medium">
                  Formatos permitidos: Word, PDF, Excel e Imágenes
                </p>
              </label>
              <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary text-sm">
                <span className="material-symbols-outlined">info</span>
                <p>El documento se guardará de forma segura en el expediente correspondiente.</p>
              </div>
            </div>
            <div className="px-8 py-8 flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-[#dbdfe6] dark:border-[#2d3748]">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`w-full sm:w-auto px-10 py-3.5 bg-primary text-white text-base font-bold rounded-xl shadow-lg transition-opacity ${
                  selectedFile ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!selectedFile}
                onClick={handleUploadAndSave}
              >
                Subir y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};