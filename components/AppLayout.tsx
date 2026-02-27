import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import { documentsApi } from "../lib/api";
import { useDocuments } from "../lib/useDocuments";
interface UploadModalState {
    open: boolean;
    files: File[];
    uploading: boolean;
    error: string | null;
    isDragOver: boolean;
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AppLayout: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const { refresh: refreshDocuments } = useDocuments({ autoFetch: false });

    const [modal, setModal] = useState<UploadModalState>({
        open: false,
        files: [],
        uploading: false,
        error: null,
        isDragOver: false,
    });

    const openUploadModal = (files?: File[]) => {
        setModal((prev) => ({
            ...prev,
            open: true,
            files: files ? [...prev.files, ...files] : prev.files,
        }));
    };

    const closeUploadModal = () => {
        setModal({ open: false, files: [], uploading: false, error: null, isDragOver: false });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) {
            setModal((prev) => ({ ...prev, files: [...prev.files, ...files], error: null }));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setModal((prev) => ({ ...prev, isDragOver: true }));
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setModal((prev) => ({ ...prev, isDragOver: false }));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setModal((prev) => ({ ...prev, isDragOver: false, files: [...prev.files, ...files], error: null }));
        }
    };

    const handleRemoveFile = (index: number) => {
        setModal((prev) => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
    };

    const handleUploadAndSave = async () => {
        if (modal.files.length === 0) return;
        setModal((prev) => ({ ...prev, uploading: true, error: null }));
        try {
            let lastDoc: any = null;
            for (const file of modal.files) {
                lastDoc = await documentsApi.upload(file);
            }
            closeUploadModal();
            await refreshDocuments();
            if (modal.files.length === 1 && lastDoc?.id) {
                const isExcel = lastDoc.type?.toUpperCase() === 'XLSX' || lastDoc.type?.toUpperCase() === 'XLS';
                navigate(isExcel ? `/documento/${lastDoc.id}/excel` : `/documento/${lastDoc.id}`);
            }
        } catch (err: any) {
            setModal((prev) => ({ ...prev, uploading: false, error: err.message ?? 'Error al subir el archivo' }));
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#111318] dark:text-white">
            <AppHeader
                onUploadClick={() => openUploadModal()}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            <Outlet context={{ searchQuery, openUploadModal, refreshDocuments }} />

            <AppFooter />

            {/* ─── Upload Modal ─────────────────────────────────────────── */}
            {modal.open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
                    onClick={(e) => { if (e.target === e.currentTarget) closeUploadModal(); }}
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
                                className={`group relative border-4 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${modal.isDragOver
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
                                <div className={`bg-primary/10 text-primary p-6 rounded-full mb-6 transition-transform ${modal.isDragOver ? 'scale-125' : 'group-hover:scale-110'}`}>
                                    <span className="material-symbols-outlined text-6xl">cloud_upload</span>
                                </div>
                                <p className="text-xl font-semibold text-[#111318] dark:text-white text-center">
                                    {modal.isDragOver ? 'Suelte los archivos aquí' : 'Arrastre aquí su archivo o haga clic para buscar'}
                                </p>
                                <p className="text-[#616f89] dark:text-[#a0aec0] mt-4 text-sm font-medium">
                                    Formatos permitidos: Word, PDF, Excel e Imágenes (máx. 50 MB)
                                </p>
                            </label>

                            {modal.files.length > 0 && (
                                <div className="mt-6 space-y-3">
                                    <h4 className="text-sm font-bold text-[#111318] dark:text-white">
                                        {modal.files.length} archivo{modal.files.length > 1 ? 's' : ''} seleccionado{modal.files.length > 1 ? 's' : ''}
                                    </h4>
                                    {modal.files.map((file, idx) => (
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
                                                disabled={modal.uploading}
                                            >
                                                <span className="material-symbols-outlined text-xl">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {modal.error && (
                                <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    <span className="material-symbols-outlined">error</span>
                                    <p>{modal.error}</p>
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
                                disabled={modal.uploading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`w-full sm:w-auto px-10 py-3.5 bg-primary text-white text-base font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${modal.files.length > 0 && !modal.uploading ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
                                    }`}
                                disabled={modal.files.length === 0 || modal.uploading}
                                onClick={handleUploadAndSave}
                            >
                                {modal.uploading ? (
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
};
