import React, { useState } from 'react';
import { formatDate, formatTimeAgo } from '../lib/formatters';

export interface GenericComment {
    id: string;
    content: string;
    createdAt: string | Date;
    isResolved?: boolean;
    user: { name: string; avatarUrl?: string | null };
    replies?: {
        id: string;
        content: string;
        createdAt: string | Date;
        user: { name: string; avatarUrl?: string | null };
    }[];
}

interface CommentsTabProps {
    comments: GenericComment[];
    onAddComment: (content: string) => Promise<void>;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({ comments, onAddComment }) => {
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!newComment.trim()) return;
        setSubmitting(true);
        try {
            await onAddComment(newComment.trim());
            setNewComment('');
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-gray-50 dark:bg-[#0a0a14]">
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-[#0e0e1b] dark:text-white mb-1">Comentarios</h2>
                        <p className="text-gray-500">Discusión activa.</p>
                    </div>
                </div>

                {/* New comment form */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario…"
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-[#0e0e1b] dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        rows={3}
                    />
                    <div className="flex justify-end mt-3">
                        <button
                            onClick={handleSubmit}
                            disabled={!newComment.trim() || submitting}
                            className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting && (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            )}
                            Comentar
                        </button>
                    </div>
                </div>

                {comments.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <span className="material-symbols-outlined text-6xl mb-4 block">chat_bubble</span>
                        <p className="text-lg">Aún no hay comentarios.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {comments.map((comment) => (
                            <div key={comment.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${comment.isResolved ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-blue-100 dark:border-blue-900/30 ring-1 ring-blue-500/10'}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        {comment.user.avatarUrl ? (
                                            <img src={comment.user.avatarUrl} alt={comment.user.name} className="size-10 rounded-full" />
                                        ) : (
                                            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {comment.user.name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-bold text-[#0e0e1b] dark:text-white">{comment.user.name}</h4>
                                            <p className="text-xs text-gray-500">{formatDate(comment.createdAt)} · {formatTimeAgo(comment.createdAt)}</p>
                                        </div>
                                    </div>
                                    {comment.isResolved ? (
                                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">check</span> Resuelto
                                        </span>
                                    ) : (
                                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente</span>
                                    )}
                                </div>
                                <p className="text-gray-800 dark:text-gray-200 mb-4 ml-13">{comment.content}</p>

                                {/* Replies */}
                                {comment.replies && comment.replies.map(reply => (
                                    <div key={reply.id} className="ml-8 mt-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm dark:text-white">{reply.user.name}</span>
                                            <span className="text-xs text-gray-400">{formatDate(reply.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{reply.content}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
