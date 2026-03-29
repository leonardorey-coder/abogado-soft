import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, createContext, useContext } from "react";
import type { LucideIcon } from "lucide-react";
import { X, ChevronLeft, ChevronRight, MoreVertical, Loader2, AlertCircle, FolderOpen, CheckCircle2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS COMUNES
   ═══════════════════════════════════════════════════════════════════════════ */

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";
export type StatVariant = "default" | "success" | "warning" | "error" | "primary";
export type EmptyStateVariant = "empty" | "search" | "error";

/* ═══════════════════════════════════════════════════════════════════════════
   AppShellContext — búsqueda, acción primaria y refresh compartido
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AppShellContextValue {
  searchQuery: string;
  openUploadModal: (files?: File[]) => void;
  refreshDocuments: () => Promise<void>;
}

export const AppShellContext = createContext<AppShellContextValue | null>(null);
export const useAppShell = () => useContext(AppShellContext);

/* ═══════════════════════════════════════════════════════════════════════════
   PageHeader
   ═══════════════════════════════════════════════════════════════════════════ */

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
    <div className="flex flex-col gap-1 min-w-0">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {action && (
      <div className="basis-full sm:basis-auto shrink-0 w-full sm:w-auto">
        {action}
      </div>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SectionCard
   ═══════════════════════════════════════════════════════════════════════════ */

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  action?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, children, className = "", noPadding, action }) => (
  <div className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm ${className}`}>
    {title && (
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    <div className={noPadding ? "" : "p-5"}>{children}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   StatCard
   ═══════════════════════════════════════════════════════════════════════════ */

const STAT_VARIANT_STYLES: Record<StatVariant, { icon: string; bar: string }> = {
  default: { icon: "text-slate-500", bar: "bg-slate-400" },
  primary: { icon: "text-primary", bar: "bg-primary" },
  success: { icon: "text-green-600 dark:text-green-400", bar: "bg-green-500" },
  warning: { icon: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  error:   { icon: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: StatVariant;
  total?: number;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, variant = "default", total, onClick }) => {
  const s = STAT_VARIANT_STYLES[variant];
  const pct = total && typeof value === "number" && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 p-3 sm:p-4 shadow-sm flex flex-col gap-2 sm:gap-3 ${onClick ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate pr-1">{label}</span>
        <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${s.icon}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</span>
        {pct !== null && <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">{pct}%</span>}
      </div>
      {pct !== null && (
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1 overflow-hidden mt-1 sm:mt-0">
          <div className={`h-1 rounded-full transition-all ${s.bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   StatusBadge
   ═══════════════════════════════════════════════════════════════════════════ */

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/60",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60",
  error:   "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/60",
  info:    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/60",
  neutral: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600",
};

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone, dot, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${TONE_CLASSES[tone]} ${className}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${tone === "success" ? "bg-green-500" : tone === "warning" ? "bg-amber-500" : tone === "error" ? "bg-red-500" : tone === "info" ? "bg-blue-500" : "bg-slate-400"}`} />}
    {label}
  </span>
);

/* ═══════════════════════════════════════════════════════════════════════════
   FilterPills
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FilterPill {
  key: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface FilterBarProps {
  pills: FilterPill[];
  active: string;
  onChange: (key: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ pills, active, onChange }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 no-scrollbar">
    {pills.map((p) => {
      const isActive = active === p.key;
      return (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border whitespace-nowrap shrink-0 ${
            isActive
              ? "bg-primary text-white border-primary"
              : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-primary/40"
          }`}
        >
          {p.icon && <p.icon className="w-3.5 h-3.5" />}
          {p.label}
          {p.count !== undefined && <span className={`tabular-nums ${isActive ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>({p.count})</span>}
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   ActionMenu (three-dot)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  closeOnClick?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  onClose?: () => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ items, onClose }) => {
  const [open, setOpen] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    onClose?.();
    setOpen(false);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;

    const margin = 6;
    const compute = () => {
      const m = menuRef.current;
      const t = triggerRef.current;
      if (!m || !t) return;
      const menuH = m.offsetHeight;
      const rect = t.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewTop = vv?.offsetTop ?? 0;
      const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
      const spaceBelow = viewBottom - rect.bottom - margin;
      const spaceAbove = rect.top - viewTop - margin;
      let above: boolean;
      if (menuH <= spaceBelow) above = false;
      else if (menuH <= spaceAbove) above = true;
      else above = spaceAbove >= spaceBelow;
      setPlaceAbove(above);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(menu);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", compute);
    vv?.addEventListener("scroll", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
      vv?.removeEventListener("resize", compute);
      vv?.removeEventListener("scroll", compute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) closeMenu(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, closeMenu]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-10 h-10 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Más opciones"
      >
        <MoreVertical className="w-5 h-5 sm:w-4 sm:h-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className={`absolute right-0 z-30 min-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 animate-in fade-in ${
            placeAbove
              ? "bottom-full mb-1 slide-in-from-bottom-1"
              : "top-full mt-1 slide-in-from-top-1"
          }`}
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.separator && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />}
              <button
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  if (item.closeOnClick !== false) closeMenu();
                }}
                className={`w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-base sm:text-sm font-medium flex items-center gap-3 sm:gap-2.5 transition-colors disabled:opacity-50 ${
                  item.danger
                    ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                {item.icon && <item.icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   EmptyState
   ═══════════════════════════════════════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon = FolderOpen, title, description, action, variant = "empty" }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${variant === "error" ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-100 dark:bg-slate-800"}`}>
      <Icon className={`w-6 h-6 ${variant === "error" ? "text-red-400" : "text-slate-400"}`} />
    </div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{title}</p>
    {description && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   ModalFrame
   ═══════════════════════════════════════════════════════════════════════════ */

interface ModalFrameProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const MODAL_SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export const ModalFrame: React.FC<ModalFrameProps> = ({ open, onClose, title, description, icon: Icon, children, footer, size = "md" }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white dark:bg-slate-800 w-full ${MODAL_SIZES[size]} rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[90vh] sm:max-h-[85vh] border-t sm:border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && <Icon className="w-6 h-6 sm:w-5 sm:h-5 text-primary shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-base font-bold text-slate-900 dark:text-white">{title}</h2>
              {description && <p className="text-sm sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 sm:w-8 sm:h-8 rounded-full sm:rounded-md flex items-center justify-center bg-slate-100 sm:bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 transition-colors shrink-0">
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pb-safe">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-4 sm:py-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/30 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Pagination
   ═══════════════════════════════════════════════════════════════════════════ */

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  showing?: number;
  label?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, total, showing, label = "elementos" }) => (
  <div className="flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
    <button
      type="button"
      disabled={page <= 1}
      onClick={() => onPageChange(page - 1)}
      className="inline-flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0 h-10 sm:h-auto px-3 sm:py-1.5 rounded-lg sm:rounded-md text-sm sm:text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-800"
    >
      <ChevronLeft className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Anterior</span>
    </button>
    <div className="text-xs text-slate-500 dark:text-slate-400 text-center flex-1">
      {showing !== undefined && total !== undefined ? (
        <span>Mostrando <span className="font-semibold text-slate-700 dark:text-slate-200">{showing}</span> de {total} <span className="hidden sm:inline">{label}</span></span>
      ) : (
        <span>Pág. <span className="font-semibold text-slate-700 dark:text-slate-200">{page}</span> de {totalPages}</span>
      )}
    </div>
    <button
      type="button"
      disabled={page >= totalPages}
      onClick={() => onPageChange(page + 1)}
      className="inline-flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0 h-10 sm:h-auto px-3 sm:py-1.5 rounded-lg sm:rounded-md text-sm sm:text-xs font-semibold border border-slate-200 dark:border-slate-700 text-primary hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-800"
    >
      <span className="hidden sm:inline">Siguiente</span> <ChevronRight className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
    </button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Toast
   ═══════════════════════════════════════════════════════════════════════════ */

interface ToastProps {
  message: string;
  type: "success" | "error";
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, type, visible }) => (
  <div
    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2.5 px-5 py-3 rounded-lg shadow-lg border transition-all duration-300 ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
    } ${
      type === "success"
        ? "bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200"
        : "bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200"
    }`}
  >
    {type === "success" ? <CheckCircle2 className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
    <span className="text-sm font-semibold">{message}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Spinner
   ═══════════════════════════════════════════════════════════════════════════ */

export const Spinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <Loader2 className={`animate-spin ${className}`} />
);

/* ═══════════════════════════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════════════════════════ */

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
);

/* ═══════════════════════════════════════════════════════════════════════════
   Primary Button
   ═══════════════════════════════════════════════════════════════════════════ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: LucideIcon;
  loading?: boolean;
  size?: "sm" | "md";
}

export const Button: React.FC<ButtonProps> = ({ variant = "primary", icon: Icon, loading, children, size = "md", className = "", ...props }) => {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizeClass = size === "sm" ? "px-3 py-2 sm:py-1.5 text-sm sm:text-xs min-h-[36px] sm:min-h-0" : "px-4 py-3 sm:py-2.5 text-base sm:text-sm min-h-[44px] sm:min-h-0";
  const variants = {
    primary: "bg-primary text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700",
    ghost: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  };
  return (
    <button className={`${base} ${sizeClass} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner className="w-4 h-4" /> : Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};
