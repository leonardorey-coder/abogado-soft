import React, { useState, useEffect } from "react";
import { Document } from "../types";
import { usersApi, assignmentsApi, ApiUser } from "../lib/api";

interface AssignModalProps {
    document: Document;
    onClose: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({ document, onClose }) => {
    const [assignedUserId, setAssignedUserId] = useState<string>("");
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [notes, setNotes] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [toast, setToast] = useState<{ message: string; visible: boolean; type: "success" | "error" } | null>(null);

    useEffect(() => {
        usersApi.list({ limit: 100 }).then(res => setUsers(res.data)).catch(err => console.error("Error loading users:", err));
    }, []);

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, visible: true, type });
        setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 2500);
        setTimeout(() => setToast(null), 3000);
    };

    const handleAssign = async () => {
        if (!assignedUserId) return;
        try {
            setIsAssigning(true);
            await assignmentsApi.create({
                documentId: document.id,
                assignedTo: assignedUserId,
                notes: notes.trim() || undefined,
                dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
            });
            showToast("Documento asignado correctamente", "success");
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error(err);
            showToast(err.message || "Error al asignar documento", "error");
        } finally {
            setIsAssigning(false);
        }
    };

    const inputClass = "min-h-[48px] flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-[#dbdfe6] dark:border-[#2d3748] bg-gray-50 dark:bg-[#101622] text-[#111318] dark:text-white text-sm focus:border-primary border-primary focus:outline-none transition-colors";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                        <h2 className="text-xl font-bold text-[#111318] dark:text-white">Asignar Documento</h2>
                    </div>
                    <p className="text-[#616f89] dark:text-[#a0aec0] text-sm truncate" title={document.name}>
                        {document.name}
                    </p>
                </div>

                <div className="p-6 flex flex-col gap-5">
                    <div>
                        <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">Usuario a asignar</label>
                        <div className="grid grid-cols-2 gap-2 max-h-[130px] overflow-y-auto p-0.5">
                            {users.map((u) => {
                                const isSelected = assignedUserId === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => setAssignedUserId(u.id)}
                                        className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border transition-all text-left ${isSelected
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/50"
                                                : "border-[#dbdfe6] dark:border-[#2d3748] hover:border-primary/50 bg-white dark:bg-[#1a212f]"
                                            }`}
                                    >
                                        {u.avatarUrl ? (
                                            <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs uppercase ${isSelected
                                                    ? "bg-primary text-white"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                }`}>
                                                {u.name.substring(0, 2)}
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-xs font-bold leading-tight truncate ${isSelected ? "text-primary dark:text-primary" : "text-[#111318] dark:text-white"
                                                }`}>
                                                {u.name}
                                            </span>
                                            <span className="text-[10px] leading-tight text-[#616f89] dark:text-[#a0aec0] truncate">
                                                {u.email}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {users.length === 0 && (
                                <div className="col-span-2 text-center py-4 text-sm text-slate-500">
                                    Cargando usuarios...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">Instrucciones (opcional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className={`${inputClass} w-full min-h-[100px] py-3 resize-none`}
                                placeholder="Ej. Por favor revisa el documento antes del viernes..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">Fecha límite (opcional)</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className={`${inputClass} w-full`}
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 flex justify-end gap-3 border-t border-[#dbdfe6] dark:border-[#2d3748] bg-slate-50 dark:bg-[#101622]/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={isAssigning || !assignedUserId}
                        onClick={handleAssign}
                        className={`px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-sm flex-1 max-w-[200px] flex items-center justify-center gap-2 ${isAssigning || !assignedUserId
                            ? "bg-primary/50 cursor-not-allowed"
                            : "bg-primary hover:opacity-90 hover:shadow-md"
                            }`}
                    >
                        {isAssigning ? (
                            <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-lg">send</span>
                        )}
                        {isAssigning ? "Asignando..." : "Asignar"}
                    </button>
                </div>
            </div>

            {toast && (
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-500 ${toast.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        } ${toast.type === 'success'
                            ? "bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200"
                            : "bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200"
                        }`}
                >
                    <span className="material-symbols-outlined text-2xl">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};
