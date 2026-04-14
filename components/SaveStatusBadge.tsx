// ============================================================================
// SaveStatusBadge — Indicador de estado de guardado (local + servidor)
// Usado en: DocumentEditor, DocumentXlsxEditor, DocumentsList
// El popover se renderiza en document.body via portal + position:fixed
// para escapar cualquier stacking context del layout padre.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatTimeAgo } from '../lib/formatters';

export interface SaveStatusBadgeProps {
  /** Hay cambios sin guardar en el editor */
  hasChanges: boolean;
  /** Actualmente guardando */
  isSaving: boolean;
  /** Fecha ISO del último guardado exitoso en el servidor */
  lastSavedAt: string | null;
  /** El último guardado en el servidor fue exitoso */
  remoteSyncOk: boolean | null;
  /** Error del último guardado remoto (si aplica) */
  remoteSyncError?: string | null;
  /** El usuario eligió una ubicación local para guardar */
  hasLocalHandle?: boolean;
  /** Fecha del último guardado local exitoso */
  lastLocalSaveAt?: Date | null;
  /** Fecha del último borrador guardado en IndexedDB */
  draftSavedAt?: Date | null;
  /** Callback para guardar */
  onSave?: () => void;
  /** Si puede guardar (permisos) */
  canSave?: boolean;
  /** Modo compacto para tablas — solo ícono, popover pequeño */
  compact?: boolean;
  /** className adicional para el contenedor */
  className?: string;
}

// ─── Posición calculada para el portal ───────────────────────────────────────

interface PopoverPosition {
  top: number;
  left: number;
}

function calcPopoverPosition(trigger: HTMLElement): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const popoverWidth = 256; // w-64 = 16rem = 256px
  let left = rect.right - popoverWidth;
  // Evitar que salga por la izquierda de la pantalla
  if (left < 8) left = 8;
  return {
    top: rect.bottom + 6,
    left,
  };
}

// ─── Derive visual state ──────────────────────────────────────────────────────

type VisualState = 'saving' | 'ok' | 'unsaved' | 'error' | 'idle';

function deriveVisual(props: SaveStatusBadgeProps): {
  state: VisualState;
  icon: string;
  iconClass: string;
  label: string;
  labelClass: string;
} {
  if (props.isSaving) {
    return {
      state: 'saving',
      icon: 'sync',
      iconClass: 'animate-spin text-blue-500',
      label: 'Guardando…',
      labelClass: 'text-blue-600 dark:text-blue-400',
    };
  }

  if (props.hasChanges) {
    return {
      state: 'unsaved',
      icon: 'cloud_upload',
      iconClass: 'text-amber-500',
      label: 'Sin guardar',
      labelClass: 'text-amber-600 dark:text-amber-400',
    };
  }

  if (props.remoteSyncOk === false) {
    return {
      state: 'error',
      icon: 'cloud_off',
      iconClass: 'text-red-500',
      label: 'Error al guardar',
      labelClass: 'text-red-600 dark:text-red-400',
    };
  }

  if (props.remoteSyncOk === true || props.lastSavedAt) {
    return {
      state: 'ok',
      icon: 'cloud_done',
      iconClass: 'text-emerald-500',
      label: props.lastSavedAt ? `Guardado ${formatTimeAgo(props.lastSavedAt)}` : 'Sincronizado',
      labelClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  return {
    state: 'idle',
    icon: 'cloud_queue',
    iconClass: 'text-slate-400 dark:text-slate-500',
    label: 'Sin actividad',
    labelClass: 'text-slate-500 dark:text-slate-400',
  };
}

// ─── Popover Content ──────────────────────────────────────────────────────────

const PopoverContent: React.FC<SaveStatusBadgeProps & { onClose: () => void }> = (props) => {
  const {
    hasChanges,
    isSaving,
    lastSavedAt,
    remoteSyncOk,
    remoteSyncError,
    hasLocalHandle,
    lastLocalSaveAt,
    draftSavedAt,
    onSave,
    canSave,
    onClose,
  } = props;

  const rowBase = 'flex items-start gap-3 py-2.5';
  const iconBase = 'material-symbols-outlined text-[18px] mt-0.5 shrink-0';
  const labelBase = 'text-xs font-bold text-slate-700 dark:text-slate-200';
  const subBase = 'text-[11px] text-slate-400 dark:text-slate-500 mt-0.5';

  // Local status
  const localOk = !!hasLocalHandle && !!lastLocalSaveAt;
  const localStatus = isSaving
    ? 'Guardando…'
    : localOk
    ? `Guardado ${formatTimeAgo(lastLocalSaveAt!.toISOString())}`
    : hasLocalHandle
    ? 'Sin guardado local reciente'
    : 'No activado';

  const localIcon = isSaving
    ? 'sync'
    : localOk
    ? 'check_circle'
    : hasLocalHandle
    ? 'radio_button_unchecked'
    : 'laptop_mac';

  const localIconClass = isSaving
    ? 'animate-spin text-blue-500'
    : localOk
    ? 'text-emerald-500'
    : 'text-slate-400';

  // Remote status
  const remoteOk = remoteSyncOk !== false && !!lastSavedAt;
  const remoteIcon = isSaving
    ? 'sync'
    : remoteSyncOk === false
    ? 'cloud_off'
    : remoteOk
    ? 'cloud_done'
    : 'cloud_queue';

  const remoteIconClass = isSaving
    ? 'animate-spin text-blue-500'
    : remoteSyncOk === false
    ? 'text-red-500'
    : remoteOk
    ? 'text-emerald-500'
    : 'text-slate-400';

  const remoteStatus = isSaving
    ? 'Guardando…'
    : remoteSyncOk === false
    ? remoteSyncError ?? 'Error al sincronizar'
    : lastSavedAt
    ? `Guardado ${formatTimeAgo(lastSavedAt)}`
    : 'Sin datos';

  const handleSave = () => {
    onSave?.();
    onClose();
  };

  return (
    <div className="w-64 p-3 space-y-0.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
        Estado de guardado
      </p>

      {/* Draft row (IndexedDB borrador) */}
      {draftSavedAt && (
        <>
          <div className={rowBase}>
            <span className={`${iconBase} text-amber-500`}>history</span>
            <div className="flex-1 min-w-0">
              <p className={labelBase}>Borrador local</p>
              <p className={subBase}>{formatTimeAgo(draftSavedAt.toISOString())}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                Recuperable hasta 7 días después
              </p>
            </div>
          </div>
          <div className="w-full h-px bg-slate-100 dark:bg-slate-700/60 my-1" />
        </>
      )}

      {/* Local row */}
      <div className={rowBase}>
        <span className={`${iconBase} ${localIconClass}`}>{localIcon}</span>
        <div className="flex-1 min-w-0">
          <p className={labelBase}>En tu equipo</p>
          <p className={subBase}>{localStatus}</p>
          {!hasLocalHandle && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
              Se activa al elegir dónde guardar el archivo
            </p>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-slate-100 dark:bg-slate-700/60 my-1" />

      {/* Remote row */}
      <div className={rowBase}>
        <span className={`${iconBase} ${remoteIconClass}`}>{remoteIcon}</span>
        <div className="flex-1 min-w-0">
          <p className={labelBase}>En el servidor</p>
          <p className={`${subBase} ${remoteSyncOk === false ? 'text-red-500' : ''}`}>
            {remoteStatus}
          </p>
        </div>
      </div>

      {/* Save button */}
      {(hasChanges || remoteSyncOk === false) && onSave && canSave && !isSaving && (
        <>
          <div className="w-full h-px bg-slate-100 dark:bg-slate-700/60 my-1" />
          <button
            type="button"
            onClick={handleSave}
            className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            Guardar y sincronizar ahora
          </button>
        </>
      )}
    </div>
  );
};

// ─── Portal Popover ───────────────────────────────────────────────────────────
// Renderiza en document.body para escapar cualquier stacking context del layout.

interface PortalPopoverProps extends SaveStatusBadgeProps {
  position: PopoverPosition;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

const PortalPopover: React.FC<PortalPopoverProps> = ({
  position,
  onMouseEnter,
  onMouseLeave,
  onClose,
  ...rest
}) => {
  return createPortal(
    <div
      style={{ top: position.top, left: position.left, position: 'fixed', zIndex: 99999 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl shadow-black/15"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <PopoverContent {...rest} onClose={onClose} />
    </div>,
    document.body,
  );
};

// ─── Main Badge Component ─────────────────────────────────────────────────────

export const SaveStatusBadge: React.FC<SaveStatusBadgeProps> = (props) => {
  const { compact = false, className = '' } = props;
  const [popover, setPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { icon, iconClass, label, labelClass } = deriveVisual(props);

  const openPopover = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (triggerRef.current) {
      setPopoverPos(calcPopoverPosition(triggerRef.current));
    }
    setPopover(true);
  }, []);

  const scheduleClose = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setPopover(false), 220);
  }, []);

  const cancelClose = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const closePopover = useCallback(() => setPopover(false), []);

  const handleToggle = useCallback(() => {
    if (popover) {
      closePopover();
    } else {
      openPopover();
    }
  }, [popover, openPopover, closePopover]);

  // Close on outside click
  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover, closePopover]);

  // Close on scroll/resize
  useEffect(() => {
    if (!popover) return;
    const handler = () => closePopover();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [popover, closePopover]);

  // Cleanup
  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  const triggerBtnClass = compact
    ? 'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
    : 'inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none';

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerBtnClass}
        aria-label="Ver estado de guardado"
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onClick={handleToggle}
      >
        <span className={`material-symbols-outlined text-base ${iconClass}`}>{icon}</span>
        {!compact && (
          <span className={`hidden sm:inline ${labelClass} truncate max-w-[12rem]`}>{label}</span>
        )}
      </button>

      {popover && (
        <PortalPopover
          {...props}
          position={popoverPos}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClose={closePopover}
        />
      )}
    </div>
  );
};
