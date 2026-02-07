import React, { useState } from "react";
import { ViewState } from "../types";

interface DocumentEditorProps {
  onNavigate: (view: ViewState) => void;
}

type EditorTab = 'EDITOR' | 'HISTORY' | 'COMMENTS' | 'DETAILS';

// Mock data for versions
const versions = [
  {
    id: "current",
    label: "Versión Actual",
    date: "Hoy, 24 de Octubre",
    time: "10:30 AM",
    author: "Dr. Arévalo",
    isCurrent: true,
    content: `Entre los suscritos a saber...`
  },
  {
    id: "v1.2",
    label: "v1.2",
    date: "23 de Octubre",
    time: "4:15 PM",
    author: "Dr. Arévalo",
    note: "Revisión de Cláusula Tercera",
    content: `Entre los suscritos a saber...`
  },
  {
    id: "v1.1",
    label: "v1.1",
    date: "22 de Octubre",
    time: "11:20 AM",
    author: "Lic. García",
    note: "Borrador inicial aprobado",
    content: "..."
  },
  {
    id: "v1.0",
    label: "v1.0",
    date: "21 de Octubre",
    time: "09:00 AM",
    author: "Lic. García",
    note: "Documento creado",
    content: "..."
  }
];

// Mock data for comments
const comments = [
  {
    id: 1,
    author: "Lic. García",
    avatar: "https://i.pravatar.cc/150?u=1",
    text: "Por favor revisar la cláusula tercera, el monto no coincide con lo acordado en la reunión preliminar.",
    date: "23 Oct, 10:00 AM",
    resolved: false,
    replies: [
        {
            id: 101,
            author: "Dr. Arévalo",
            text: "Corregido en la versión v1.2. Se ajustó a $4.5M.",
            date: "23 Oct, 11:30 AM"
        }
    ]
  },
  {
    id: 2,
    author: "Maria Valdés",
    avatar: "https://i.pravatar.cc/150?u=2",
    text: "¿Es necesario adjuntar la fotocopia de la cédula en este mismo archivo o va por separado?",
    date: "22 Oct, 04:15 PM",
    resolved: true
  }
];

// Mock data for case details
const caseDetails = {
    fileNumber: "2023-084",
    title: "Demanda Civil - Pérez vs. García",
    client: "Juan Pérez",
    court: "Juzgado 5to de lo Civil",
    status: "En Proceso",
    startDate: "15 de Enero, 2023",
    type: "Civil / Contractual",
    description: "Proceso ordinario por incumplimiento de contrato de arrendamiento comercial. Se busca la restitución del inmueble y el pago de cánones adeudados."
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('EDITOR');
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  const toggleVersionSelection = (id: string) => {
    if (selectedVersions.includes(id)) {
      setSelectedVersions(selectedVersions.filter(v => v !== id));
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, id]);
      }
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowDiff(true);
    }
  };

  const exitCompare = () => {
    setShowDiff(false);
    setIsCompareMode(false);
    setSelectedVersions([]);
  };

  // Render Functions for Views
  const renderHistoryView = () => (
    <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-2">Historial de Auditoría</h2>
            <p className="text-gray-500 mb-8">Registro completo de cambios y accesos al documento.</p>
            
            <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                {versions.map((v, idx) => (
                    <div key={v.id} className="relative pl-8">
                        <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-2 border-white dark:border-background-dark ${idx === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <div>
                                <span className={`text-sm font-bold px-2 py-0.5 rounded ${idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                    {v.label}
                                </span>
                                <span className="text-sm text-gray-400 ml-2">{v.time} - {v.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="size-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                    {v.author.charAt(0)}
                                </div>
                                <span className="text-sm font-medium dark:text-gray-300">{v.author}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-[#0e0e1b] dark:text-white font-medium mb-1">
                                {idx === 0 ? "Edición actual y guardado automático" : v.note}
                            </p>
                            <p className="text-xs text-gray-500">
                                {idx === 0 ? "El sistema ha sincronizado los cambios." : "Se modificaron 15 líneas. Se agregaron 2 comentarios."}
                            </p>
                            {idx !== 0 && (
                                <div className="mt-3 flex gap-2">
                                    <button className="text-xs font-bold text-primary hover:underline">Ver Diferencias</button>
                                    <span className="text-gray-300">|</span>
                                    <button className="text-xs font-bold text-primary hover:underline">Descargar Copia</button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
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
                 <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-blue-700 transition">
                    + Nuevo Comentario
                 </button>
            </div>

            <div className="space-y-6">
                {comments.map((comment) => (
                    <div key={comment.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${comment.resolved ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-blue-100 dark:border-blue-900/30 ring-1 ring-blue-500/10'}`}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <img src={comment.avatar} alt={comment.author} className="size-10 rounded-full" />
                                <div>
                                    <h4 className="font-bold text-[#0e0e1b] dark:text-white">{comment.author}</h4>
                                    <p className="text-xs text-gray-500">{comment.date}</p>
                                </div>
                            </div>
                            {comment.resolved ? (
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">check</span> Resuelto
                                </span>
                            ) : (
                                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente</span>
                            )}
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 mb-4 ml-13">{comment.text}</p>
                        
                        {/* Replies */}
                        {comment.replies && comment.replies.map(reply => (
                            <div key={reply.id} className="ml-8 mt-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-sm dark:text-white">{reply.author}</span>
                                    <span className="text-xs text-gray-400">{reply.date}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{reply.text}</p>
                            </div>
                        ))}

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-4">
                            <button className="text-sm font-bold text-gray-500 hover:text-primary transition-colors">Responder</button>
                            {!comment.resolved && <button className="text-sm font-bold text-gray-500 hover:text-success-green transition-colors">Marcar como Resuelto</button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderDetailsView = () => (
    <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
             <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-2">Detalles del Caso</h2>
             <p className="text-gray-500 mb-8">Información del expediente vinculado.</p>

             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-primary/5 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-primary">{caseDetails.title}</h3>
                        <p className="text-sm text-gray-500 font-mono">Expediente #{caseDetails.fileNumber}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">
                        {caseDetails.status}
                    </span>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente Principal</label>
                        <p className="text-lg font-semibold dark:text-white">{caseDetails.client}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Juzgado / Instancia</label>
                        <p className="text-lg font-semibold dark:text-white">{caseDetails.court}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo de Proceso</label>
                        <p className="text-lg font-semibold dark:text-white">{caseDetails.type}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha de Inicio</label>
                        <p className="text-lg font-semibold dark:text-white">{caseDetails.startDate}</p>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descripción del Caso</label>
                        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            {caseDetails.description}
                        </p>
                    </div>
                </div>

                <div className="px-8 py-6 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition">
                        Ver Expediente Completo
                    </button>
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition">
                        Editar Información
                    </button>
                </div>
             </div>
        </div>
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark font-display flex-1 flex flex-col">
      <div className="flex grow min-h-0 overflow-hidden">
        {/* Left Side Bar Navigation */}
        <aside className="w-64 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col p-4">
          <div className="mb-8">
            <h1 className="text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight">
              Contrato de Prestación de Servicios
            </h1>
            <p className="text-gray-500 text-sm mt-1">Versión Final • 45 KB</p>
          </div>
          <nav className="flex flex-col gap-2 grow">
            <button
              onClick={() => setActiveTab('EDITOR')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors text-left w-full ${activeTab === 'EDITOR' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined">edit_note</span>
              <span>Editor Principal</span>
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${activeTab === 'HISTORY' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined">history</span>
              <span>Historial</span>
            </button>
            <button
              onClick={() => setActiveTab('COMMENTS')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${activeTab === 'COMMENTS' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined">chat_bubble</span>
              <span>Comentarios</span>
            </button>
            <button
              onClick={() => setActiveTab('DETAILS')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${activeTab === 'DETAILS' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined">info</span>
              <span>Detalles del Caso</span>
            </button>
          </nav>
          <button 
            onClick={() => onNavigate(ViewState.DASHBOARD)}
            className="mt-auto w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/5 transition-colors"
           >
            <span className="material-symbols-outlined">logout</span>
            Cerrar Editor
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-hidden">
          {activeTab === 'EDITOR' && (
             <>
             {/* ToolBar (Only for Editor) */}
                <div className="bg-white dark:bg-background-dark border-b border-[#e7e7f3] dark:border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {showDiff ? (
                        <button 
                        onClick={exitCompare}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-700 transition-colors"
                        >
                        <span className="material-symbols-outlined">close</span>
                        Salir de Comparación
                        </button>
                    ) : (
                        <>
                        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                        <span className="material-symbols-outlined">save</span>
                        Guardar
                        </button>
                        <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-lg hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined">download</span>
                        Descargar
                        </button>
                        </>
                    )}
                    <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 text-[#0e0e1b] dark:text-white rounded-xl font-bold text-lg hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined">share</span>
                    Compartir
                    </button>
                </div>
                {/* Simplified Formatting Bar */}
                {!showDiff && (
                    <div className="flex items-center gap-1 bg-background-light dark:bg-white/5 p-1 rounded-xl">
                    <button className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm">
                        <span className="material-symbols-outlined">format_bold</span>
                    </button>
                    <button className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm">
                        <span className="material-symbols-outlined">format_italic</span>
                    </button>
                    <button className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm">
                        <span className="material-symbols-outlined">
                        format_underlined
                        </span>
                    </button>
                    <div className="w-px h-6 bg-gray-300 dark:bg-white/20 mx-1"></div>
                    <button className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm flex items-center gap-2">
                        <span className="text-sm font-bold">16px</span>
                        <span className="material-symbols-outlined text-sm">
                        expand_more
                        </span>
                    </button>
                    </div>
                )}
                </div>

                {/* Editor Document Area */}
                <div className="flex-1 overflow-y-auto p-12 flex justify-center">
                    {showDiff ? (
                        // Diff View UI
                        <div className="w-full max-w-[1200px] flex gap-4">
                            <div className="flex-1">
                                <div className="mb-2 text-center font-bold text-red-600 bg-red-50 py-2 rounded">Versión Anterior (v1.2)</div>
                                <div className="editor-paper w-full bg-white dark:bg-gray-100 p-10 rounded-sm shadow-md min-h-[800px] text-lg text-gray-800">
                                    <h2 className="text-center font-bold mb-4">CONTRATO DE PRESTACIÓN DE SERVICIOS</h2>
                                    <p className="mb-4">Entre los suscritos a saber...</p>
                                    <div className="bg-red-100 p-2 border-l-4 border-red-500 mb-4 rounded">
                                        <p className="line-through text-red-800">
                                            TERCERA. HONORARIOS: EL CONTRATANTE pagará al CONTRATISTA por la ejecución total del objeto una suma mensual fija de $4.500.000, sujeta a retenciones de ley.
                                        </p>
                                    </div>
                                    <p>
                                        <strong>CUARTA. OBLIGACIONES:</strong> ...
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="mb-2 text-center font-bold text-green-600 bg-green-50 py-2 rounded">Versión Actual</div>
                                <div className="editor-paper w-full bg-white dark:bg-gray-100 p-10 rounded-sm shadow-md min-h-[800px] text-lg text-gray-800">
                                    <h2 className="text-center font-bold mb-4">CONTRATO DE PRESTACIÓN DE SERVICIOS</h2>
                                    <p className="mb-4">Entre los suscritos a saber...</p>
                                    <div className="bg-green-100 p-2 border-l-4 border-green-500 mb-4 rounded">
                                        <p className="text-green-800 font-medium">
                                            TERCERA. HONORARIOS: EL CONTRATANTE pagará al CONTRATISTA por la ejecución total del objeto una suma mensual fija de $5.000.000, previa presentación del informe de actividades.
                                        </p>
                                    </div>
                                    <p>
                                        <strong>CUARTA. OBLIGACIONES:</strong> ...
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Standard Editor UI
                        <div className="editor-paper w-full max-w-[850px] min-h-[1100px] bg-white dark:bg-gray-100 p-20 rounded-sm shadow-md">
                        <h1 className="text-center text-2xl font-bold mb-10 text-gray-900 underline">
                            CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES
                        </h1>
                        <div className="space-y-8 text-xl leading-relaxed text-gray-800 text-justify">
                            <p>
                            Entre los suscritos a saber, por una parte la{" "}
                            <strong>UNIVERSIDAD DE DERECHO APLICADO</strong>, institución
                            de educación superior debidamente reconocida, representada
                            legalmente por el Rector en funciones, quien para los efectos
                            del presente contrato se denominará EL CONTRATANTE.
                            </p>
                            <p>
                            Y por la otra parte, el profesional{" "}
                            <strong>DR. ROBERTO AREVALO</strong>, mayor de edad,
                            identificado con la cédula de ciudadanía adjunta, quien para
                            efectos del presente contrato se denominará EL CONTRATISTA.
                            </p>
                            <p>
                            Se ha convenido celebrar el presente Contrato de Prestación de
                            Servicios, el cual se regirá por las siguientes cláusulas:
                            </p>
                            <p>
                            <strong>PRIMERA. OBJETO:</strong> El objeto del presente
                            contrato es la asesoría jurídica especializada en materia de
                            propiedad intelectual para los proyectos de investigación
                            vinculados a la Facultad de Derecho.
                            </p>
                            <p>
                            <strong>SEGUNDA. DURACIÓN:</strong> El término de duración del
                            presente contrato será de seis (6) meses contados a partir de
                            la firma del acta de inicio.
                            </p>
                            <p>
                            <strong>TERCERA. HONORARIOS:</strong> EL CONTRATANTE pagará al
                            CONTRATISTA por la ejecución total del objeto una suma mensual
                            fija, previa presentación del informe de actividades y cuenta
                            de cobro.
                            </p>
                            <div className="pt-16 border-t border-gray-200 mt-20 flex justify-between">
                            <div className="w-64 border-t-2 border-black pt-4 text-center">
                                <p className="font-bold">EL CONTRATANTE</p>
                                <p className="text-sm text-gray-600">Representante Legal</p>
                            </div>
                            <div className="w-64 border-t-2 border-black pt-4 text-center">
                                <p className="font-bold">EL CONTRATISTA</p>
                                <p className="text-sm text-gray-600">C.C. 1.234.567.890</p>
                            </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            </>
          )}

          {activeTab === 'HISTORY' && renderHistoryView()}
          {activeTab === 'COMMENTS' && renderCommentsView()}
          {activeTab === 'DETAILS' && renderDetailsView()}
        </main>

        {/* Right Side Bar - Version History / Quick Actions (Only visible in Editor Mode) */}
        {activeTab === 'EDITOR' && (
        <aside className="w-80 border-l border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col">
          <div className="p-6 border-b border-[#e7e7f3] dark:border-white/10 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-[#0e0e1b] dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                history
              </span>
              Historial de Versiones
            </h3>
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Modo Comparación</span>
                <button 
                    onClick={() => {
                        setIsCompareMode(!isCompareMode);
                        setSelectedVersions([]);
                        setShowDiff(false);
                    }}
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
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {versions.map((v) => (
                <div 
                    key={v.id}
                    onClick={() => isCompareMode && toggleVersionSelection(v.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group relative
                        ${v.isCurrent ? 'border-2 border-primary bg-primary/5' : 'border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5'}
                        ${selectedVersions.includes(v.id) ? 'ring-2 ring-offset-2 ring-primary' : ''}
                    `}
                >
                    {isCompareMode && (
                        <div className="absolute top-3 right-3">
                             <div className={`size-5 rounded border flex items-center justify-center ${selectedVersions.includes(v.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                                {selectedVersions.includes(v.id) && <span className="material-symbols-outlined text-white text-xs">check</span>}
                             </div>
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-2 pr-6">
                        {v.isCurrent ? (
                             <span className="bg-primary text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">Versión Actual</span>
                        ) : (
                             <span className="text-xs font-bold text-gray-400">{v.label}</span>
                        )}
                        <span className="text-xs text-gray-500">{v.time}</span>
                    </div>
                    <p className="font-bold text-[#0e0e1b] dark:text-white">{v.date}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {v.isCurrent ? `Editado por: ${v.author}` : v.note}
                    </p>

                    {!isCompareMode && !v.isCurrent && (
                        <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors">
                                Ver
                            </button>
                            <button className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                                Restaurar esta versión
                            </button>
                        </div>
                    )}
                </div>
            ))}
          </div>
          
          {/* Comparison Action Bar */}
          {isCompareMode && selectedVersions.length === 2 && (
             <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark animate-in slide-in-from-bottom">
                 <button 
                    onClick={handleCompare}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-blue-700 transition-colors"
                 >
                     <span className="material-symbols-outlined">compare_arrows</span>
                     Comparar Versiones
                 </button>
             </div>
          )}

          {/* Sync Indicator Panel */}
          {!isCompareMode && (
            <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10">
                <div className="flex flex-col gap-3 rounded-xl border border-success-green/30 bg-success-green/5 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                    <p className="text-[#0e0e1b] dark:text-white text-sm font-bold">
                        Respaldo Automático
                    </p>
                    <p className="text-success-green text-xs font-medium">
                        Activado y Seguro
                    </p>
                    </div>
                    <label className="relative flex h-[24px] w-[44px] cursor-pointer items-center rounded-full border-none bg-success-green p-0.5">
                    <div
                        className="h-full w-[20px] rounded-full bg-white ml-auto"
                        style={{
                        boxShadow: "rgba(0, 0, 0, 0.15) 0px 3px 8px",
                        }}
                    ></div>
                    <input
                        defaultChecked
                        className="invisible absolute"
                        type="checkbox"
                    />
                    </label>
                </div>
                <p className="text-gray-500 text-[11px] leading-tight">
                    Todos los cambios han sido guardados de forma segura en la nube
                    de la Universidad.
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