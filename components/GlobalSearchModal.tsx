// =============================================================================
// GlobalSearchModal — Búsqueda inteligente con contexto legal
// Two-pane layout: lista de hits izquierda + detalle/snippet derecho.
// El resultado muestra exactamente dónde está la información dentro del documento.
// Activable con ⌘K / Ctrl+K desde cualquier página de la app.
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
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { searchApi, type SearchHit, type SearchEntityType } from "../lib/api";
import { sanitizeHighlight } from "../lib/sanitize";

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
  {
    label: string;
    Icon: React.FC<{ className?: string }>;
    color: string;
    bg: string;
    accent: string;
  }
> = {
  document: {
    label: "Documentos",
    Icon: FileText,
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    accent: "border-blue-400/50",
  },
  convenio: {
    label: "Convenios",
    Icon: Scale,
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    accent: "border-emerald-400/50",
  },
  case: {
    label: "Expedientes",
    Icon: Briefcase,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    accent: "border-amber-400/50",
  },
};

/** Quita tags <mark> para texto plano */
function stripMark(html: string): string {
  return html.replace(/<\/?mark>/g, "");
}

/** Formatea fecha relativa */
function formatRelative(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Muestra fechas de creación + edición compactas */
function DateBadges({ createdAt, updatedAt }: { createdAt?: string; updatedAt?: string }) {
  const created = formatRelative(createdAt);
  const updated = formatRelative(updatedAt);
  if (!created && !updated) return null;
  if (created === updated || !created) {
    return (
      <span className="text-[10px] text-slate-400 dark:text-slate-500">
        Editado: {updated}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-slate-400 dark:text-slate-500">
      Creado: {created} · Editado: {updated}
    </span>
  );
}

/* ─── Subcomponents ────────────────────────────────────────────────────────── */

/** Renderiza HTML con <mark> de Meilisearch de forma segura */
const HighlightedText: React.FC<{
  html: string;
  className?: string;
}> = ({ html, className }) => (
  <span
    className={className}
    dangerouslySetInnerHTML={{ __html: sanitizeHighlight(html) }}
  />
);

/** Tarjeta de resultado en el panel izquierdo */
const HitListItem: React.FC<{
  hit: SearchHit;
  isActive: boolean;
  onSelect: () => void;
  onNavigate: () => void;
}> = ({ hit, isActive, onSelect, onNavigate }) => {
  const meta = ENTITY_META[hit.entityType];
  const Icon = meta.Icon;
  const hasSnippet = !!hit.contentSnippet;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onNavigate}
      onMouseEnter={onSelect}
      className={`
        w-full text-left flex items-start gap-3 px-3 py-3 transition-all duration-100 rounded-xl mx-1 my-0.5
        ${isActive
          ? "bg-slate-100 dark:bg-slate-700/80 shadow-sm"
          : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
        }
      `}
    >
      {/* Icono */}
      <span
        className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}
      >
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </span>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {/* Título */}
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">
          <HighlightedText html={hit.highlight ?? hit.title} />
        </p>
        {/* Subtítulo o snippet inline corto */}
        {hasSnippet ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            <HighlightedText html={hit.contentSnippet!} />
          </p>
        ) : hit.subtitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {stripMark(hit.subtitle)}
          </p>
        ) : null}
        {/* Badge tipo + fecha */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {!!hit.meta?.type && (
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}
            >
              {String(hit.meta.type)}
            </span>
          )}
          {!!hit.meta?.estado && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {String(hit.meta.estado)}
            </span>
          )}
          <DateBadges createdAt={hit.createdAt} updatedAt={hit.updatedAt} />
        </div>
      </div>

      {/* Arrow indicator */}
      <ChevronRight
        className={`w-3.5 h-3.5 shrink-0 self-center transition-all duration-100 ${
          isActive
            ? `${meta.color} opacity-100 translate-x-0.5`
            : "opacity-0 text-slate-300"
        }`}
      />
    </button>
  );
};

/** Panel de detalle derecho: snippet completo del hit activo */
const HitDetailPane: React.FC<{
  hit: SearchHit | null;
  query: string;
  onNavigate: (hit: SearchHit) => void;
}> = ({ hit, query, onNavigate }) => {
  if (!hit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 px-6">
        <Search className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm text-center opacity-60">
          Selecciona un resultado para ver el contexto
        </p>
      </div>
    );
  }

  const meta = ENTITY_META[hit.entityType];
  const Icon = meta.Icon;
  const hasSnippet = !!hit.contentSnippet;

  return (
    <div className="flex flex-col h-full">
      {/* Header del detalle */}
      <div className={`px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/60`}>
        <div className="flex items-start gap-3">
          <span className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg}`}>
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              {meta.label}
            </p>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              <HighlightedText html={hit.highlight ?? hit.title} />
            </h3>
            {hit.subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stripMark(hit.subtitle)}
              </p>
            )}
          </div>
        </div>

        {/* Badges de metadata */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {!!hit.meta?.type && (
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${meta.bg} ${meta.color}`}>
              {String(hit.meta.type)}
            </span>
          )}
          {!!hit.meta?.estado && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {String(hit.meta.estado)}
            </span>
          )}
          {!!hit.meta?.status && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {String(hit.meta.status)}
            </span>
          )}
          <DateBadges createdAt={hit.createdAt} updatedAt={hit.updatedAt} />
        </div>
      </div>

      {/* Snippet de contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {hasSnippet ? (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Fragmento encontrado
              </p>
            </div>
            {/* Snippet card */}
            <div className={`relative rounded-xl border-l-4 ${meta.accent} bg-slate-50 dark:bg-slate-800/60 px-4 py-3`}>
              <blockquote className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed search-snippet-text">
                <HighlightedText html={`"${hit.contentSnippet!}"`} />
              </blockquote>
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              El texto resaltado muestra dónde se encontró "
              <span className="font-medium text-slate-600 dark:text-slate-300">{query}</span>
              " dentro del documento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs text-center">
              No hay fragmento de contenido disponible.
              <br />
              La coincidencia fue encontrada en el título o metadatos.
            </p>
          </div>
        )}
      </div>

      {/* CTA: abrir documento */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-700/60 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate(hit)}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            text-sm font-semibold text-white transition-all duration-150
            bg-primary hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98]
          `}
        >
          {hit.entityType === "document"
            ? "Abrir y saltar al fragmento"
            : "Abrir"}
          <ArrowRight className="w-4 h-4" />
        </button>
        {hit.entityType === "document" && (
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2">
            El editor hará scroll automático al párrafo encontrado
          </p>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────────── */

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

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Navegar al resultado activo
  const navigateToHit = useCallback(
    (hit: SearchHit) => {
      onClose();
      // Para documentos: pasar el query como state para scroll automático
      if (hit.entityType === "document") {
        navigate(hit.url, {
          state: { searchHighlight: debouncedQuery.trim() },
        });
      } else {
        navigate(hit.url);
      }
    },
    [navigate, onClose, debouncedQuery]
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

  // Scroll automático al item activo en la lista
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[activeIdx] as
        | HTMLElement
        | undefined;
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
  const showEmpty =
    !loading && debouncedQuery.trim() && !hasResults && !error;
  const activeHit = hits[activeIdx] ?? null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[8vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda inteligente"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel principal */}
      <div
        className={`
          relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
          border border-slate-200/80 dark:border-slate-700/50 overflow-hidden
          flex flex-col
          transition-all duration-200
          ${hasResults
            ? "max-w-3xl max-h-[78vh]"
            : "max-w-xl max-h-[60vh]"
          }
        `}
      >
        {/* ── Barra de búsqueda ── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          {loading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cláusulas, convenios, expedientes…"
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

        {/* ── Área de resultados ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Estado vacío / error / sin resultados */}
          {!hasResults && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              {!query.trim() && (
                <>
                  <Search className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Búsqueda inteligente</p>
                  <p className="text-xs mt-1.5 opacity-70 text-center max-w-xs">
                    Escribe para encontrar información dentro de documentos, convenios y expedientes
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-xs">
                    {[
                      "cláusula terminación",
                      "convenio UNAM",
                      "fecha vencimiento",
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQuery(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 hover:bg-primary/10 hover:text-primary dark:hover:text-blue-400 text-slate-500 dark:text-slate-400 transition-colors font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 px-4 text-center">
                  {error}
                </p>
              )}
              {showEmpty && (
                <>
                  <Clock className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">
                    Sin resultados para "
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {debouncedQuery}
                    </span>
                    "
                  </p>
                  <p className="text-xs mt-1.5 opacity-60">
                    Intenta con términos diferentes
                  </p>
                </>
              )}
            </div>
          )}

          {/* Two-pane: lista + detalle */}
          {hasResults && (
            <>
              {/* ── Panel izquierdo: lista de hits ── */}
              <div className="w-[46%] shrink-0 border-r border-slate-100 dark:border-slate-700/60 flex flex-col overflow-hidden">
                <ul
                  ref={listRef}
                  className="flex-1 overflow-y-auto overscroll-contain py-2 px-0.5"
                  role="listbox"
                  aria-label="Resultados de búsqueda"
                >
                  {(
                    Object.entries(grouped) as [SearchEntityType, SearchHit[]][]
                  )
                    .filter(([, g]) => g.length > 0)
                    .map(([type, group]) => {
                      const meta = ENTITY_META[type];
                      return (
                        <li key={type}>
                          {/* Section header */}
                          <div className="px-4 pt-3 pb-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                              {meta.label}
                            </span>
                          </div>
                          {/* Hits */}
                          {group.map((hit) => {
                            const globalIdx = hits.indexOf(hit);
                            return (
                              <HitListItem
                                key={hit.id}
                                hit={hit}
                                isActive={globalIdx === activeIdx}
                                onSelect={() => setActiveIdx(globalIdx)}
                                onNavigate={() => navigateToHit(hit)}
                              />
                            );
                          })}
                        </li>
                      );
                    })}
                </ul>

                {/* Contador */}
                <div className="shrink-0 px-4 py-2 border-t border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {hits.length} resultado{hits.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* ── Panel derecho: detalle del hit activo ── */}
              <div className="flex-1 min-w-0 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                <HitDetailPane
                  hit={activeHit}
                  query={debouncedQuery}
                  onNavigate={navigateToHit}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Footer: atajos de teclado ── */}
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-700/60 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/60">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[9px] text-slate-600 dark:text-slate-300">
              ↑↓
            </kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[9px] text-slate-600 dark:text-slate-300">
              ↵
            </kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[9px] text-slate-600 dark:text-slate-300">
              Esc
            </kbd>
            cerrar
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Por nombre, extensión y contenido
          </span>
        </div>
      </div>
    </div>
  );
};
