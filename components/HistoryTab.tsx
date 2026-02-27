import React from 'react';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';

export interface GenericVersion {
    id: string;
    version: number;
    createdAt: string | Date;
    changeNote?: string | null;
    size?: number | bigint;
    creator?: { name: string } | null;
}

interface HistoryTabProps {
    versions: GenericVersion[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ versions }) => {
    return (
        <div className="flex-1 overflow-y-auto p-8 md:p-12">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-2">Historial de Auditoría</h2>
                <p className="text-gray-500 mb-8">Registro completo de cambios y accesos.</p>

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
                                        {v.changeNote ?? (idx === 0 ? 'Versión actual' : 'Actualización')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {v.size !== undefined ? `Tamaño: ${formatFileSize(v.size)} — ` : ''}{formatTimeAgo(v.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
