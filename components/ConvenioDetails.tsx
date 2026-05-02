import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { conveniosApi, activityApi, ApiConvenio, ApiActivityLog, documentsApi, ApiDocument } from "../lib/api";
import { HistoryTab } from "./HistoryTab";
import { CommentsTab } from "./CommentsTab";
import { getDocumentRoute } from "../lib/routes";
import { useDocumentPins } from "../lib/useDocumentPins";
import { useToast } from "../contexts/ToastContext";
import { Pin } from "lucide-react";

type ConvenioTab = 'DETAILS' | 'HISTORY' | 'COMMENTS';

const getEstadoBadge = (estado: string) => {
    switch (estado) {
        case "activo": return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
        case "pendiente": return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800";
        case "vencido": case "expirado": return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
        case "cancelado": return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
        default: return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300";
    }
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case "DOCX": case "doc": case "docx": return "description";
        case "PDF": case "pdf": return "picture_as_pdf";
        case "XLSX": case "xls": case "xlsx": return "table_view";
        default: return "article";
    }
};

export const ConvenioDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [convenio, setConvenio] = useState<ApiConvenio | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal de vincular documento
    const [showAddDocModal, setShowAddDocModal] = useState(false);
    const [availableDocs, setAvailableDocs] = useState<ApiDocument[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>("");
    const [linkingDoc, setLinkingDoc] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<ConvenioTab>('DETAILS');
    const [activityLogs, setActivityLogs] = useState<ApiActivityLog[]>([]);

    const { pinnedIds, toggle: togglePin } = useDocumentPins();
    const { addToast } = useToast();

    const sortedConvenioDocuments = useMemo(() => {
        if (!convenio?.documents?.length) return [];
        return [...convenio.documents].sort((a: { document?: { id?: string; name?: string } }, b: { document?: { id?: string; name?: string } }) => {
            const da = a.document?.id;
            const db = b.document?.id;
            const ap = da && pinnedIds.has(da) ? 1 : 0;
            const bp = db && pinnedIds.has(db) ? 1 : 0;
            if (ap !== bp) return bp - ap;
            return (a.document?.name || "").localeCompare(b.document?.name || "", "es", { sensitivity: "base" });
        });
    }, [convenio?.documents, pinnedIds]);

    const fetchConvenio = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await conveniosApi.get(id);
            setConvenio(data);
        } catch (err: any) {
            setError(err.message || "Error al cargar los detalles del convenio");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConvenio();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        activityApi.list({ page: 1, limit: 100, entityType: 'convenio', entityId: id })
            .then(res => setActivityLogs(res.data ?? []))
            .catch(() => setActivityLogs([]));
    }, [id]);

    const fetchAvailableDocs = async () => {
        try {
            const res = await documentsApi.list({ limit: 50 }); // simplificación: muestra últimos 50
            setAvailableDocs(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenAddDoc = () => {
        setShowAddDocModal(true);
        fetchAvailableDocs();
    };

    const handleLinkDoc = async () => {
        if (!id || !selectedDocId) return;
        try {
            setLinkingDoc(true);
            await conveniosApi.linkDocument(id, selectedDocId);
            await fetchConvenio();
            setShowAddDocModal(false);
            setSelectedDocId("");
        } catch (err: any) {
            alert(err.message || "Error al vincular el documento");
        } finally {
            setLinkingDoc(false);
        }
    };

    const handleUnlinkDoc = async (documentId: string) => {
        if (!id) return;
        if (!confirm("¿Está seguro de desvincular este documento del convenio?")) return;
        try {
            await conveniosApi.unlinkDocument(id, documentId);
            await fetchConvenio();
        } catch (err: any) {
            alert(err.message || "Error al desvincular");
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        if (!confirm(`¿Eliminar definitivamente el convenio ${convenio?.numero}?`)) return;
        try {
            await conveniosApi.delete(id);
            navigate("/convenios");
        } catch (err: any) {
            alert(err.message || "Error al eliminar");
        }
    };

    const handleAddComment = async (content: string) => {
        if (!id) return;
        try {
            await conveniosApi.addComment(id, { content });
            await fetchConvenio();
        } catch (err: any) {
            console.error('Error agregando comentario:', err);
            throw err; // propagated to CommentsTab
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (error || !convenio) {
        return (
            <div className="p-8 text-center text-red-600 font-bold dark:text-red-400">
                {error || "Convenio no encontrado."}
            </div>
        );
    }

    return (
        <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
            {/* Header y Acciones */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-2">
                    <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
                        <Link to="/" className="hover:text-primary">Inicio</Link>
                        <span>/</span>
                        <Link to="/convenios" className="hover:text-primary">Convenios</Link>
                        <span>/</span>
                        <span className="text-[#111318] dark:text-white">{convenio.numero}</span>
                    </nav>
                    <div className="flex items-center gap-4">
                        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight flex items-center gap-3">
                            {convenio.numero}
                            <span className={`text-sm px-3 py-1 rounded-full border shadow-sm uppercase font-bold tracking-wider ${getEstadoBadge(convenio.estado)}`}>
                                {convenio.estado}
                            </span>
                        </h1>
                    </div>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-lg max-w-2xl">
                        {convenio.institucion} {convenio.departamento ? `- ${convenio.departamento}` : ""}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/convenio/${convenio.id}/tabla`)}
                        className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">table_view</span> Editor de Tabla
                    </button>
                    <button
                        onClick={() => navigate(`/convenio/${convenio.id}/editar`)}
                        className="flex items-center gap-2 bg-white dark:bg-[#1a212f] hover:bg-gray-50 dark:hover:bg-[#2d3748] border border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span> Editar
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">delete</span> Eliminar
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[#dbdfe6] dark:border-[#2d3748] mb-8 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('DETAILS')}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'DETAILS' ? 'border-primary text-primary' : 'border-transparent text-[#616f89] hover:text-[#111318] dark:text-[#a0aec0] dark:hover:text-white'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    Detalles Generales
                </button>
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-[#616f89] hover:text-[#111318] dark:text-[#a0aec0] dark:hover:text-white'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    Historial de Cambios
                </button>
                <button
                    onClick={() => setActiveTab('COMMENTS')}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'COMMENTS' ? 'border-primary text-primary' : 'border-transparent text-[#616f89] hover:text-[#111318] dark:text-[#a0aec0] dark:hover:text-white'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                    Comentarios
                </button>
            </div>

            {activeTab === 'DETAILS' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Detalles Generales */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-[#111318] dark:text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">info</span>
                                Información General
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <dt className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0] mb-1">Monto Estimado</dt>
                                    <dd className="text-lg font-black text-[#111318] dark:text-white">
                                        {convenio.monto ? `$${Number(convenio.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "N/A"}
                                    </dd>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0] mb-1">Fecha Inicio</dt>
                                        <dd className="text-base font-medium text-[#111318] dark:text-white">
                                            {new Date(convenio.fechaInicio).toLocaleDateString("es-ES")}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0] mb-1">Fecha Fin</dt>
                                        <dd className="text-base font-medium text-[#111318] dark:text-white">
                                            {new Date(convenio.fechaFin).toLocaleDateString("es-ES")}
                                        </dd>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <dt className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0] mb-1">Descripción</dt>
                                    <dd className="text-sm text-[#111318] dark:text-white leading-relaxed">
                                        {convenio.descripcion || <span className="italic text-gray-400">Sin descripción</span>}
                                    </dd>
                                </div>
                                <div className="pt-2">
                                    <dt className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0] mb-1">Notas</dt>
                                    <dd className="text-sm text-[#111318] dark:text-white bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-[#dbdfe6] dark:border-[#2d3748]">
                                        {convenio.notas || <span className="italic text-gray-400">Ninguna nota adicional</span>}
                                    </dd>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Anexos Documentales */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h2 className="text-xl font-bold text-[#111318] dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">folder_open</span>
                                    Documentos Anexos
                                    <span className="bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-[#a0aec0] px-2 py-0.5 rounded-full text-xs font-black">
                                        {convenio.documents?.length || 0}
                                    </span>
                                </h2>
                                <button
                                    onClick={handleOpenAddDoc}
                                    className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors text-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span> Vincular Documento
                                </button>
                            </div>

                            <div className="border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl overflow-hidden">
                                <div className="hidden md:block overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead className="bg-[#f6f6f8] dark:bg-[#101622] border-b border-[#dbdfe6] dark:border-[#2d3748]">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-extrabold text-[#111318] dark:text-white uppercase tracking-wider">Documento</th>
                                                <th className="px-4 py-3 text-xs font-extrabold text-[#111318] dark:text-white uppercase tracking-wider text-center">Tipo</th>
                                                <th className="px-4 py-3 text-xs font-extrabold text-[#111318] dark:text-white uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
                                            {sortedConvenioDocuments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-10 text-center text-[#616f89] dark:text-[#a0aec0]">
                                                        <span className="material-symbols-outlined text-3xl mb-2 block opacity-50">description</span>
                                                        No hay documentos vinculados a este convenio.
                                                    </td>
                                                </tr>
                                            ) : (
                                                sortedConvenioDocuments.map((cd: any) => {
                                                    const doc = cd.document;
                                                    const docPinned = pinnedIds.has(doc.id);
                                                    return (
                                                        <tr key={doc.id} className="group hover:bg-gray-50 dark:hover:bg-[#1a212f]/50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="material-symbols-outlined text-[#616f89]">{getTypeIcon(doc.type)}</span>
                                                                    <span className="font-bold text-[#111318] dark:text-white truncate max-w-[200px] sm:max-w-xs">{doc.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-[#a0aec0] px-2 py-1 rounded">
                                                                    {doc.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        aria-pressed={docPinned}
                                                                        title={docPinned ? "Quitar fijación" : "Fijar"}
                                                                        className={`p-1.5 rounded transition-colors ${
                                                                            docPinned
                                                                                ? "opacity-100 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30"
                                                                                : "opacity-0 group-hover:opacity-100 text-[#616f89] hover:bg-gray-100 dark:hover:bg-[#2d3748]"
                                                                        }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            void (async () => {
                                                                                const ok = await togglePin(doc.id);
                                                                                if (!ok) addToast({ message: "No se pudo actualizar la fijación", type: "error" });
                                                                            })();
                                                                        }}
                                                                    >
                                                                        <Pin className={`w-[18px] h-[18px] ${docPinned ? "fill-current" : ""}`} strokeWidth={docPinned ? 2.5 : 2} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(getDocumentRoute(doc.id, doc.type))}
                                                                        title="Ver Documento"
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUnlinkDoc(doc.id)}
                                                                        title="Desvincular Documento"
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[20px]">link_off</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Mobile card view */}
                                <div className="md:hidden flex flex-col divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
                                    {sortedConvenioDocuments.length === 0 ? (
                                        <div className="px-6 py-10 text-center text-[#616f89] dark:text-[#a0aec0]">
                                            <span className="material-symbols-outlined text-3xl mb-2 block opacity-50">description</span>
                                            No hay documentos vinculados a este convenio.
                                        </div>
                                    ) : (
                                        sortedConvenioDocuments.map((cd: any) => {
                                            const doc = cd.document;
                                            const docPinned = pinnedIds.has(doc.id);
                                            return (
                                                <div key={doc.id} className="group relative p-4 flex flex-col gap-3 hover:bg-gray-50 dark:hover:bg-[#1a212f]/50 transition-colors">
                                                    <button
                                                        type="button"
                                                        aria-pressed={docPinned}
                                                        title={docPinned ? "Quitar fijación" : "Fijar"}
                                                        className={`absolute right-3 top-3 z-10 rounded-md border p-1.5 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                                            docPinned
                                                                ? "opacity-100 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                                                : "opacity-0 group-hover:opacity-100 border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] text-[#616f89]"
                                                        }`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void (async () => {
                                                                const ok = await togglePin(doc.id);
                                                                if (!ok) addToast({ message: "No se pudo actualizar la fijación", type: "error" });
                                                            })();
                                                        }}
                                                    >
                                                        <Pin className={`w-3.5 h-3.5 ${docPinned ? "fill-current" : ""}`} strokeWidth={docPinned ? 2.5 : 2} />
                                                    </button>
                                                    <div className="flex items-start gap-3 pr-10">
                                                        <span className="material-symbols-outlined text-[#616f89] text-2xl shrink-0">{getTypeIcon(doc.type)}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider block mb-0.5">Documento</span>
                                                            <span className="font-bold text-[#111318] dark:text-white line-clamp-2 leading-tight">{doc.name}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center bg-[#f6f6f8] dark:bg-[#101622] p-2.5 rounded-lg">
                                                        <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wider">Tipo</span>
                                                        <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 text-[#616f89] dark:text-[#a0aec0] px-2 py-1 rounded">
                                                            {doc.type}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-end gap-2 mt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(getDocumentRoute(doc.id, doc.type))}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg font-bold text-xs transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">visibility</span> Ver
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnlinkDoc(doc.id)}
                                                            className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">link_off</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <HistoryTab versions={convenio.versions as any || []} activityLogs={activityLogs} />
            )}

            {activeTab === 'COMMENTS' && (
                <CommentsTab comments={convenio.comments as any || []} onAddComment={handleAddComment} />
            )}

            {/* Modal Vincular Documento */}
            {showAddDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#1a212f] w-full max-w-lg rounded-2xl shadow-2xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-[#dbdfe6] dark:border-[#2d3748] flex items-center gap-3 bg-[#f6f6f8] dark:bg-[#101622]">
                            <span className="material-symbols-outlined text-primary">link</span>
                            <h3 className="text-lg font-black text-[#111318] dark:text-white">Vincular Documento</h3>
                        </div>
                        <div className="p-6 space-y-4 flex-1">
                            <label className="text-sm font-bold text-[#111318] dark:text-white block px-1">
                                Seleccione un documento del sistema
                            </label>
                            <select
                                className="w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0"
                                value={selectedDocId}
                                onChange={(e) => setSelectedDocId(e.target.value)}
                            >
                                <option value="">-- Elija un documento --</option>
                                {availableDocs.map((doc) => (
                                    <option key={doc.id} value={doc.id}>
                                        {doc.name} ({doc.type})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-[#616f89] dark:text-[#a0aec0] px-1">
                                El documento seleccionado formará parte del anexo asociado a este convenio.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-[#f6f6f8] dark:bg-[#101622] border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowAddDocModal(false)}
                                className="px-5 py-2 font-bold text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleLinkDoc}
                                disabled={!selectedDocId || linkingDoc}
                                className="bg-primary hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                            >
                                {linkingDoc ? (
                                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[18px]">add_link</span>
                                )}
                                Vincular
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};
