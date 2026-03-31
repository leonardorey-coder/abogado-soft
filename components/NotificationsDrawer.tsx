import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  FileText,
  UserCheck,
  Share2,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { notificationsApi, type ApiNotification } from "../lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `Hace ${days}d`;
  if (hrs > 0) return `Hace ${hrs}h`;
  if (mins > 0) return `Hace ${mins}m`;
  return "Ahora";
}

function notifIcon(type: string) {
  switch (type) {
    case "ASSIGNMENT":
      return <UserCheck className="w-4 h-4 text-blue-500" />;
    case "SHARE":
      return <Share2 className="w-4 h-4 text-violet-500" />;
    case "DOCUMENT":
      return <FileText className="w-4 h-4 text-slate-500" />;
    case "WARNING":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    default:
      return <Info className="w-4 h-4 text-primary" />;
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface NotificationsDrawerProps {
  open: boolean;
  notifications: ApiNotification[];
  loading: boolean;
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  notifications,
  loading,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}) => {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const handleNotifClick = (notif: ApiNotification) => {
    if (!notif.isRead) onMarkRead(notif.id);
    onClose();
    if (notif.entityId && notif.entityType === "document") {
      navigate(`/documento/${notif.entityId}`);
    } else if (notif.entityId && notif.entityType === "assignment") {
      navigate(`/asignaciones`);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-full z-50
          w-[340px] sm:w-[380px]
          flex flex-col
          bg-white dark:bg-slate-900
          border-l border-slate-200 dark:border-slate-700/60
          shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
        aria-label="Panel de notificaciones"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Notificaciones
            </h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Todas leídas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Sin notificaciones
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Te avisaremos cuando haya novedades
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleNotifClick(notif)}
                    className={`
                      w-full text-left flex items-start gap-3 px-5 py-4
                      hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                      ${!notif.isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}
                    `}
                  >
                    {/* Icon */}
                    <div className={`
                      w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                      ${!notif.isRead
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-slate-100 dark:bg-slate-800"}
                    `}>
                      {notifIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${
                        !notif.isRead
                          ? "font-semibold text-slate-900 dark:text-white"
                          : "font-medium text-slate-700 dark:text-slate-300"
                      }`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {relativeTime(notif.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!loading && notifications.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/60 px-5 py-3">
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              {unreadCount === 0
                ? "Todo al día ✓"
                : `${unreadCount} sin leer · Clic para marcar como leída`}
            </p>
          </div>
        )}
      </div>
    </>
  );
};
