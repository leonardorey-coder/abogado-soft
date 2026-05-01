import React from 'react';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';
import { ApiActivityLog } from '../lib/api';
import DiffSummaryPreview from './DiffSummaryPreview';
import { useAuth } from '../contexts/AuthContext';
import { getViewerInitial, getViewerLabel } from '../lib/viewerIdentity';
import { BitacoraEntryItem } from './BitacoraEntryItem';
import { UserAvatar } from './UserAvatar';

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

type HistoryEvent =
    | { id: string; type: 'version'; createdAt: string | Date; version: GenericVersion }
    | { id: string; type: 'activity'; createdAt: string; activity: ApiActivityLog };

export const HistoryTab: React.FC<HistoryTabProps> = ({ versions, activityLogs = [] }) => {
    const { user } = useAuth();
    const avatarByUserId = activityLogs.reduce<Record<string, string>>((acc, log) => {
        if (!log.userId) return acc;
        const avatar = log.user?.avatarUrl?.trim();
        if (avatar && !acc[log.userId]) acc[log.userId] = avatar;
        return acc;
    }, {});
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
                            <div key={event.id} className="relative min-w-0 pl-6">
                                <div className={`absolute -left-[9px] top-1 size-4 rounded-full border-2 border-white dark:border-[#0a0a10] ${idx === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className="flex flex-col gap-1 mb-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                            {event.type === 'version' ? `v${event.version.version}` : 'Bitácora'}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{formatTime(event.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {event.type === 'activity' ? (
                                            <div className="size-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
                                                <UserAvatar
                                                    name={event.activity.user?.name ?? user?.name}
                                                    avatarUrl={
                                                        event.activity.user?.avatarUrl ??
                                                        (event.activity.userId ? avatarByUserId[event.activity.userId] : undefined) ??
                                                        (!event.activity.userId && event.activity.user?.name === user?.name ? user?.avatarUrl : undefined) ??
                                                        (event.activity.userId === user?.id ? user?.avatarUrl : undefined)
                                                    }
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="size-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-300">
                                                {getViewerInitial({
                                                    subjectId: event.version.creator?.id,
                                                    subjectName: event.version.creator?.name,
                                                    currentUserId: user?.id,
                                                    fallback: "?",
                                                })}
                                            </div>
                                        )}
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
                                <div className="min-w-0 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
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
                                            <BitacoraEntryItem
                                                entry={event.activity}
                                                currentUserId={user?.id}
                                                compact
                                            />
                                            {/* Diff summary */}
                                            {(event.activity.metadata as any)?.diffSummary && (
                                                <DiffSummaryPreview
                                                    diffSummary={(event.activity.metadata as any).diffSummary}
                                                    compact={false}
                                                />
                                            )}
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
