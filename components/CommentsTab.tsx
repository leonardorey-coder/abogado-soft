import React, { useState } from 'react';
import { formatDate } from '../lib/formatters';
import { UserAvatar } from './UserAvatar';

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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 text-sm bg-white dark:bg-[#0a0a10]">
            <div className="w-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-[#0e0e1b] dark:text-white mb-1">Comentarios</h2>
                        <p className="text-xs text-gray-500">Discusión activa del documento.</p>
                    </div>
                </div>

                {/* New comment form */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-6">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario…"
                        className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 py-2 text-sm text-[#0e0e1b] dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:border-primary"
                        rows={2}
                    />
                    <div className="flex justify-end mt-3">
                        <button
                            onClick={handleSubmit}
                            disabled={!newComment.trim() || submitting}
                            className="px-4 py-1.5 bg-primary text-white rounded-md font-bold text-xs shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting && (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            )}
                            Comentar
                        </button>
                    </div>
                </div>

                {comments.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block text-gray-300 dark:text-gray-700">chat_bubble</span>
                        <p className="text-sm font-medium">No hay comentarios.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <div key={comment.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border ${comment.isResolved ? 'border-gray-100 dark:border-gray-800 opacity-60' : 'border-blue-100 dark:border-primary/20 ring-1 ring-blue-500/10'}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <UserAvatar
                                            name={comment.user.name}
                                            avatarUrl={comment.user.avatarUrl}
                                            className="size-8 rounded-full object-cover"
                                        />
                                        <div>
                                            <h4 className="font-bold text-[#0e0e1b] dark:text-white text-xs">{comment.user.name}</h4>
                                            <p className="text-[10px] text-gray-500">{formatDate(comment.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-gray-800 dark:text-gray-200 mb-2 pl-10 text-xs leading-relaxed">{comment.content}</p>

                                {/* Replies */}
                                {comment.replies && comment.replies.map(reply => (
                                    <div key={reply.id} className="ml-10 mt-3 pl-3 border-l-2 border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-bold text-xs dark:text-white">{reply.user.name}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(reply.createdAt)}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{reply.content}</p>
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
