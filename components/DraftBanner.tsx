// ============================================================================
// DraftBanner — Aviso de borrador local sin guardar
//
// Mostrado cuando hay un borrador en IndexedDB para el recurso actual.
// Se posiciona como sticky dentro del área de contenido del editor.
// ============================================================================

import React from 'react';
import { formatTimeAgo } from '../lib/formatters';

export interface DraftBannerProps {
  /** Fecha ISO del borrador */
  savedAt: string;
  /** Etiqueta de versión, ej. "v2" | "versión actual" | null */
  versionLabel?: string | null;
  /** Nombre del documento o convenio */
  resourceLabel: string;
  /** Callback al hacer clic en "Restaurar" */
  onRestore: () => void;
  /** Callback al hacer clic en "Descartar" */
  onDiscard: () => void;
  /** true mientras se está restaurando (muestra spinner) */
  isRestoring?: boolean;
  /** className adicional para el contenedor */
  className?: string;
}

export const DraftBanner: React.FC<DraftBannerProps> = ({
  savedAt,
  versionLabel,
  resourceLabel,
  onRestore,
  onDiscard,
  isRestoring = false,
  className = '',
}) => {
  const versionSuffix = versionLabel ? ` (${versionLabel})` : '';
  const timeAgo = formatTimeAgo(savedAt);

  return (
    <div
      role="alert"
      className={`
        w-full z-30 flex items-center gap-3 px-4 py-2.5
        bg-amber-50 dark:bg-amber-900/20
        border-b border-amber-200 dark:border-amber-700/50
        animate-[slideDown_0.2s_ease-out]
        ${className}
      `}
    >
      {/* Ícono */}
      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] shrink-0">
        history
      </span>

      {/* Texto */}
      <p className="flex-1 text-xs text-amber-800 dark:text-amber-300 font-medium leading-tight">
        Borrador de{' '}
        <span className="font-bold">"{resourceLabel}{versionSuffix}"</span>
        {' '}guardado{' '}
        <span className="font-bold">{timeAgo}</span>
        {' '}— ¿Deseas restaurarlo?
      </p>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isRestoring}
          className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 px-1.5 py-1 rounded"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoring}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-60 shadow-sm"
        >
          {isRestoring ? (
            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[14px]">restore</span>
          )}
          Restaurar
        </button>
      </div>
    </div>
  );
};
