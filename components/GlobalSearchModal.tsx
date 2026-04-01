// =============================================================================
// GlobalSearchModal — Modal de búsqueda global estilo Spotlight
// Activable con ⌘K / Ctrl+K desde cualquier página de la app.
// Busca en documentos, convenios y expedientes — con soporte para búsqueda
// de contenido completo de archivos cuando SEARCH_ENGINE=meilisearch.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  FileText,
  Scale,
  Briefcase,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { searchApi, type SearchHit, type SearchEntityType } from "../lib/api";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const ENTITY_META: Record<
  SearchEntityType,
  { label: string; Icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  document: {
    label: "Documentos",
    Icon: FileText,
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  convenio: {
    label: "Convenios",
    Icon: Scale,
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  case: {
    label: "Expedientes",
    Icon: Briefcase,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
  },
};

function stripMark(html: string): string {
  return html.replace(/<\/?mark>/g, "");
}

/* ─── Component ────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 280);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Focus el input cuando se abre
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setHits([]);
      setActiveIdx(0);
      setError(null);
    }
  }, [open]);

  // Buscar al cambiar query con debounce
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    searchApi
      .globalSearch(debouncedQuery, { limit: 18 })
      .then((res) => {
        if (!cancelled) {
          setHits(res.hits);
          setActiveIdx(0);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Error al buscar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Navegar al resultado activo
  const navigateToHit = useCallback(
    (hit: SearchHit) => {
      onClose();
      navigate(hit.url);
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (hits.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hits[activeIdx]) navigateToHit(hits[activeIdx]);
      }
    },
    [hits, activeIdx, navigateToHit, onClose]
  );

  // Scroll automático al item activo
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[activeIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  // Agrupar hits por entityType
  const grouped = React.useMemo(() => {
    const groups: Record<SearchEntityType, SearchHit[]> = {
      document: [],
      convenio: [],
      case: [],
    };
    for (const hit of hits) {
      groups[hit.entityType]?.push(hit);
    }
    return groups;
  }, [hits]);

  const hasResults = hits.length > 0;
  const showEmpty = !loading && debouncedQuery.trim() && !hasResults && !error;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          {loading ? (
            <Loader2 className="w-4.5 h-4.5 text-primary animate-spin shrink-0" />
          ) : (
            <Search className="w-4.5 h-4.5 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar documentos, convenios, expedientes…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Empty state */}
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">Escribe para buscar</p>
              <p className="text-xs mt-1 opacity-70">
                Busca en nombre, descripción y contenido de archivos
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-10 text-center text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <Clock className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">Sin resultados para "{debouncedQuery}"</p>
            </div>
          )}

          {/* Results list */}
          {hasResults && (
            <ul ref={listRef} className="py-2" role="listbox" aria-label="Resultados">
              {(Object.entries(grouped) as [SearchEntityType, SearchHit[]][])
                .filter(([, g]) => g.length > 0)
                .map(([type, group]) => {
                  const meta = ENTITY_META[type];
                  const Icon = meta.Icon;
                  return (
                    <li key={type}>
                      {/* Section header */}
                      <div className="px-4 py-1.5 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {meta.label}
                        </span>
                      </div>
                      {/* Hits */}
                      {group.map((hit) => {
                        const globalIdx = hits.indexOf(hit);
                        const isActive = globalIdx === activeIdx;
                        return (
                          <button
                            key={hit.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => navigateToHit(hit)}
                            onMouseEnter={() => setActiveIdx(globalIdx)}
                            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors duration-75 ${
                              isActive
                                ? "bg-slate-100 dark:bg-slate-700"
                                : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            {/* Icon */}
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                            </span>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium text-slate-900 dark:text-white truncate"
                                dangerouslySetInnerHTML={{
                                  __html: hit.highlight ?? hit.title,
                                }}
                              />
                              {hit.subtitle && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {stripMark(hit.subtitle)}
                                </p>
                              )}
                            </div>

                            {/* Meta badge */}
                            {hit.meta?.type && (
                              <span className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                                {String(hit.meta.type)}
                              </span>
                            )}
                            {hit.meta?.estado && (
                              <span className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                                {String(hit.meta.estado)}
                              </span>
                            )}

                            <ChevronRight
                              className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                                isActive ? "text-primary opacity-100" : "opacity-0"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        {/* Footer kbd hints */}
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-700/60 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[9px]">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[9px]">↵</kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[9px]">Esc</kbd>
            cerrar
          </span>
          <span className="ml-auto">
            Busca en nombre y contenido de archivos
          </span>
        </div>
      </div>
    </div>
  );
};
