import React from 'react';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';
import { ApiActivityLog } from '../lib/api';
import DiffSummaryPreview from './DiffSummaryPreview';
import { useAuth } from '../contexts/AuthContext';
import { getViewerInitial, getViewerLabel } from '../lib/viewerIdentity';

export interface GenericVersion {
    id: string;
    version: number;
    createdAt: string | Date;
    changeNote?: string | null;
    size?: number | bigint;
    creator?: { id?: string; name: string } | null;
}

interface HistoryTabProps {
    versions: GenericVersion[];
    activityLogs?: ApiActivityLog[];
}

const ACTIVITY_LABELS: Record<string, string> = {
    DOCUMENT_CREATED: 'Creó documento',
    DOCUMENT_UPDATED: 'Editó documento',
    DOCUMENT_DELETED: 'Eliminó documento',
    DOCUMENT_RESTORED: 'Restauró documento',
    DOCUMENT_SHARED: 'Compartió documento',
    DOCUMENT_ASSIGNED: 'Asignó documento',
    DOCUMENT_DOWNLOADED: 'Descargó documento',
    DOCUMENT_PERMISSION_CHANGED: 'Cambió permisos',
    DOCUMENT_VERSION_CREATED: 'Creó versión',
    DOCUMENT_COMMENT_ADDED: 'Comentó documento',
    DOCUMENT_COMMENT_DELETED: 'Eliminó comentario',
    COLLABORATION_STARTED: 'Inició colaboración',
    COLLABORATION_ENDED: 'Finalizó colaboración',
    DOCUMENT_LOCKED: 'Bloqueó documento',
    DOCUMENT_UNLOCKED: 'Desbloqueó documento',
    DOCUMENT_VIEWED: 'Vio documento',
    DOCUMENT_EXTRACTED: 'Convirtió a PDF',
};

function getSpanishActivityName(activity: string): string {
    return ACTIVITY_LABELS[activity] ?? activity.replace(/_/g, ' ').toLowerCase();
}

function getActivityIcon(activity: string): string {
    const value = activity.toLowerCase();
    if (value.includes('comment') || value.includes('coment')) return 'comment';
    if (value.includes('download') || value.includes('descarg')) return 'download';
    if (value.includes('permission') || value.includes('permiso')) return 'admin_panel_settings';
    if (value.includes('assign') || value.includes('asign') || value.includes('collaboration')) return 'group';
    if (value.includes('delete') || value.includes('elimin')) return 'delete';
    if (value.includes('restore')) return 'restore';
    if (value.includes('lock')) return 'lock';
    if (value.includes('version')) return 'history';
    if (value.includes('extracted') || value.includes('pdf')) return 'picture_as_pdf';
    return 'edit_note';
}

type HistoryEvent =
    | { id: string; type: 'version'; createdAt: string | Date; version: GenericVersion }
    | { id: string; type: 'activity'; createdAt: string; activity: ApiActivityLog };

export const HistoryTab: React.FC<HistoryTabProps> = ({ versions, activityLogs = [] }) => {
    const { user } = useAuth();
    const events: HistoryEvent[] = [
        ...versions.map((v) => ({
            id: `version-${v.id}`,
            type: 'version' as const,
            createdAt: v.createdAt,
            version: v,
        })),
        ...activityLogs.map((log) => ({
            id: `activity-${log.id}`,
            type: 'activity' as const,
            createdAt: log.createdAt,
            activity: log,
        })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 text-sm bg-white dark:bg-[#0a0a10]">
            <div className="w-full">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-[#0e0e1b] dark:text-white mb-1">Historial</h2>
                    <p className="text-xs text-gray-500">Registro completo de cambios.</p>
                </div>

                {events.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block text-gray-300 dark:text-gray-700">history</span>
                        <p className="text-sm font-medium">No hay actividad registrada.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-2 space-y-6">
                        {events.map((event, idx) => (
                            <div key={event.id} className="relative pl-6">
                                <div className={`absolute -left-[9px] top-1 size-4 rounded-full border-2 border-white dark:border-[#0a0a10] ${idx === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className="flex flex-col gap-1 mb-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                            {event.type === 'version' ? `v${event.version.version}` : 'Bitácora'}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{formatTime(event.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="size-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-300">
                                            {event.type === 'version'
                                                ? getViewerInitial({
                                                    subjectId: event.version.creator?.id,
                                                    subjectName: event.version.creator?.name,
                                                    currentUserId: user?.id,
                                                    fallback: "?",
                                                })
                                                : getViewerInitial({
                                                    subjectId: event.activity.userId,
                                                    subjectName: event.activity.user?.name,
                                                    currentUserId: user?.id,
                                                    fallback: "Sistema",
                                                })}
                                        </div>
                                        <span className="text-xs font-semibold dark:text-gray-300 truncate">
                                            {event.type === 'version'
                                                ? getViewerLabel({
                                                    subjectId: event.version.creator?.id,
                                                    subjectName: event.version.creator?.name,
                                                    currentUserId: user?.id,
                                                    fallback: "Sistema",
                                                })
                                                : getViewerLabel({
                                                    subjectId: event.activity.userId,
                                                    subjectName: event.activity.user?.name,
                                                    currentUserId: user?.id,
                                                    fallback: "Sistema",
                                                })}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    {event.type === 'version' ? (
                                        <>
                                            <p className="text-[#0e0e1b] dark:text-white text-xs font-medium mb-1">
                                                {event.version.changeNote ?? (idx === 0 ? 'Versión actual' : 'Actualización')}
                                            </p>
                                            <p className="text-[10px] text-gray-500 flex justify-between">
                                                <span>{event.version.size !== undefined ? formatFileSize(event.version.size) : ''}</span>
                                                <span>{formatTimeAgo(event.version.createdAt)}</span>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-[#0e0e1b] dark:text-white text-xs font-medium mb-1 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[14px] text-primary">{getActivityIcon(event.activity.activity)}</span>
                                                {getSpanishActivityName(event.activity.activity)}
                                            </p>
                                            {event.activity.description && (
                                                <p className="text-[11px] text-gray-500 mb-1">{event.activity.description}</p>
                                            )}
                                            {/* Diff summary */}
                                            {(event.activity.metadata as any)?.diffSummary && (
                                                <DiffSummaryPreview
                                                    diffSummary={(event.activity.metadata as any).diffSummary}
                                                    compact={false}
                                                />
                                            )}
                                            <p className="text-[10px] text-gray-500 flex justify-between">
                                                <span>{event.activity.entityName ?? 'Documento'}</span>
                                                <span>{formatTimeAgo(event.activity.createdAt)}</span>
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
