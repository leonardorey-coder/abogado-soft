import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { conveniosApi, documentsApi, type ApiConvenio } from "../lib/api";
import type { FileStatus } from "../types";
import { useToast } from "../contexts/ToastContext";
import { FileStatusIconToggle } from "./FileStatusIconToggle";
import { useFileDragDrop } from "../lib/useFileDragDrop";
import { startDocDrag, endDocDrag } from "../lib/docDrag";
import {
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Upload,
  XCircle,
  Clock,
} from "lucide-react";
import { Button, Skeleton } from "./ui";
import { CloudDocThumbnail } from "./CloudDocThumbnail";
import { DocumentTypeFilter, type DocumentTypeCounts, type DocumentTypeFilterValue } from "./DocumentTypeFilter";
import type { AppLayoutOutletContext } from "./AppLayout";

type EstadoConvenio = "ACTIVO" | "PENDIENTE" | "EXPIRADO";
type FilterEstado = "TODOS" | EstadoConvenio;

const PER_PAGE = 10;

const typeFilterToDocumentType = (type: DocumentTypeFilterValue) => {
  if (type === "TODOS") return undefined;
  return type.toLowerCase();
};

const estadoFilterToApiEstado = (estado: FilterEstado) => {
  if (estado === "TODOS") return undefined;
  return estado.toLowerCase();
};

const normalizeConvenioEstado = (estado: string | null | undefined): EstadoConvenio => {
  const normalized = estado?.toUpperCase();
  if (normalized === "ACTIVO" || normalized === "PENDIENTE" || normalized === "EXPIRADO") return normalized;
  if (normalized === "VENCIDO" || normalized === "CANCELADO") return "EXPIRADO";
  return "PENDIENTE";
};

const tabConfig: Record<EstadoConvenio, { label: string; cls: string }> = {
  ACTIVO: {
    label: "Activo",
    cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  PENDIENTE: {
    label: "Pendiente",
    cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  EXPIRADO: {
    label: "Expirado",
    cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonto(monto: string | null): string | null {
  if (!monto) return null;
  const n = Number(monto);
  if (Number.isNaN(n)) return monto;
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
}

function patchConvenioAttachedFileStatus(list: ApiConvenio[], docId: string, status: FileStatus): ApiConvenio[] {
  return list.map((c) => {
    const row = c.documents?.[0];
    if (!row?.document || row.document.id !== docId) return c;
    const rest = c.documents!.slice(1);
    return {
      ...c,
      documents: [{ ...row, document: { ...row.document, fileStatus: status } }, ...rest],
    };
  });
}

export const AgreementsList: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const layout = useOutletContext<AppLayoutOutletContext>();
  const openUploadModal = layout?.openUploadModal ?? (() => {});
  const searchQuery = layout?.searchQuery ?? "";

  const { isDraggingOver } = useFileDragDrop({
    onDrop: (files) => openUploadModal(files),
  });

  const [convenios, setConvenios] = useState<ApiConvenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterEstado>("TODOS");
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilterValue>("TODOS");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ todos: 0, activos: 0, pendientes: 0, expirados: 0 });
  const [typeCounts, setTypeCounts] = useState<DocumentTypeCounts>({ TODOS: 0, DOCX: 0, XLSX: 0, PDF: 0 });

  const fetchConvenios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await conveniosApi.list({
        page,
        limit: PER_PAGE,
        estado: estadoFilterToApiEstado(filter),
        documentType: typeFilterToDocumentType(typeFilter),
        search: searchQuery || undefined,
      });
      setConvenios(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error("Error cargando convenios:", err);
    } finally {
      setLoading(false);
    }
  }, [page, filter, typeFilter, searchQuery]);

  const fetchCounts = useCallback(async () => {
    try {
      const selectedDocumentType = typeFilterToDocumentType(typeFilter);
      const [all, a, p, e] = await Promise.all([
        conveniosApi.list({ limit: 1, documentType: selectedDocumentType }),
        conveniosApi.list({ limit: 1, estado: "activo", documentType: selectedDocumentType }),
        conveniosApi.list({ limit: 1, estado: "pendiente", documentType: selectedDocumentType }),
        conveniosApi.list({ limit: 1, estado: "expirado", documentType: selectedDocumentType }),
      ]);
      setCounts({
        todos: all.pagination.total,
        activos: a.pagination.total,
        pendientes: p.pagination.total,
        expirados: e.pagination.total,
      });
      const [docx, xlsx, pdf] = await Promise.all([
        conveniosApi.list({ limit: 1, documentType: "docx" }),
        conveniosApi.list({ limit: 1, documentType: "xlsx" }),
        conveniosApi.list({ limit: 1, documentType: "pdf" }),
      ]);
      setTypeCounts({
        TODOS: all.pagination.total,
        DOCX: docx.pagination.total,
        XLSX: xlsx.pagination.total,
        PDF: pdf.pagination.total,
      });
    } catch (err) {
      console.error("Error cargando conteos:", err);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchConvenios();
  }, [fetchConvenios]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchConvenios();
      void fetchCounts();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchConvenios, fetchCounts]);

  useEffect(() => {
    setPage(1);
  }, [filter, typeFilter, searchQuery]);

  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  const handleAttachedDocumentFileStatus = async (docId: string, status: FileStatus) => {
    const fromList = convenios.flatMap((c) => c.documents ?? []).find((d) => d.document.id === docId);
    const raw = fromList?.document.fileStatus;
    const previous: FileStatus =
      raw === "PENDIENTE" || raw === "INACTIVO" ? raw : "ACTIVO";
    if (previous === status) return;
    setConvenios((prev) => patchConvenioAttachedFileStatus(prev, docId, status));
    try {
      await documentsApi.update(docId, { fileStatus: status });
    } catch {
      setConvenios((prev) => patchConvenioAttachedFileStatus(prev, docId, previous));
      addToast({ message: "No se pudo actualizar el estado del archivo.", type: "error" });
    }
  };

  const handleOpenConvenio = (id: string) => {
    if (openingId) return;
    setOpeningId(id);
    setTimeout(() => {
      navigate(`/convenio/${id}`);
      setOpeningId(null);
    }, 250);
  };

  const sortedConvenios = [...convenios].sort((a, b) =>
    a.institucion.localeCompare(b.institucion, "es", { sensitivity: "base" }),
  );

  return (
    <>
      {isDraggingOver && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border-2 border-primary">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">Suelta el archivo aquí</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se abrirá el modal de subida para adjuntar tu documento
            </p>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <nav className="flex gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Link to="/" className="hover:text-primary transition-colors">
                Inicio
              </Link>
              <span>/</span>
              <span className="text-slate-900 dark:text-white">Convenios</span>
            </nav>
            <h1 className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight">
              Todos los convenios
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Administra y visualiza los acuerdos legales de la universidad.
            </p>
          </div>
          <Button icon={Plus} onClick={() => navigate("/convenio/nuevo")} className="shrink-0">
            Nuevo Convenio
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          <DocumentTypeFilter
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
            counts={typeCounts}
          />
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar flex-1 min-w-0">
            {(
              [
                { key: "TODOS" as const, label: "Todos", count: counts.todos, icon: "check_circle", color: "" },
                { key: "ACTIVO" as const, label: "Activos", count: counts.activos, icon: "verified", color: "text-green-600" },
                { key: "PENDIENTE" as const, label: "Pendientes", count: counts.pendientes, icon: "pending", color: "text-orange-600" },
                { key: "EXPIRADO" as const, label: "Expirados", count: counts.expirados, icon: "error", color: "text-red-600" },
              ] as const
            ).map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setFilter(pill.key)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold shadow-sm transition-all shrink-0 ${
                  filter === pill.key
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-[#1a212f] border-2 border-[#dbdfe6] dark:border-[#2d3748] text-[#111318] dark:text-white hover:border-primary"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] leading-none ${
                    filter === pill.key ? "" : pill.color
                  }`}
                >
                  {pill.icon}
                </span>
                {pill.label} ({pill.count})
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 overflow-hidden"
              >
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                  <Skeleton className="h-7 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedConvenios.length === 0 ? (
          <div className="py-16 text-center">
            {searchQuery.trim() ? (
              <>
                <Search className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">Sin resultados</p>
                <p className="text-sm text-slate-500 mt-1">
                  No hay convenios para &quot;{searchQuery}&quot;
                </p>
              </>
            ) : (
              <>
                <FolderOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">No hay convenios</p>
                <p className="text-sm text-slate-500 mt-1">
                  Crea tu primer convenio para comenzar
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/convenio/nuevo")}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Convenio
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedConvenios.map((c) => {
              const estado = normalizeConvenioEstado(c.estado);
              const tab = tabConfig[estado] ?? tabConfig.PENDIENTE;
              const attached = c.documents?.[0]?.document;
              const monto = formatMonto(c.monto);
              const isOpening = openingId === c.id;

              return (
                <article
                  key={c.id}
                  className="group relative mt-3 cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-primary/40 hover:bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 flex flex-col"
                  onClick={() => handleOpenConvenio(c.id)}
                  role="button"
                  tabIndex={0}
                  draggable={!!attached}
                  onDragStart={(e) => {
                    if (!attached) return;
                    startDocDrag(e, {
                      id: attached.id,
                      name: attached.name,
                      type: attached.type,
                    });
                  }}
                  onDragEnd={() => endDocDrag()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenConvenio(c.id);
                    }
                  }}
                >
                  {/* Pestaña estado */}
                  <div
                    className={`absolute left-4 top-0 z-10 -translate-y-full rounded-t-lg border border-b-0 px-2.5 py-0.5 text-[11px] font-semibold ${tab.cls}`}
                  >
                    {tab.label}
                  </div>

                  {/* Miniatura */}
                  <div className="relative">
                    {attached ? (
                      <CloudDocThumbnail doc={attached} />
                    ) : (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl border-b border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 flex flex-col p-4 gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {c.numero}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-3 leading-tight">
                          {c.institucion}
                        </p>
                        {c.departamento && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {c.departamento}
                          </p>
                        )}
                        <div className="mt-auto space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatFecha(c.fechaInicio)} – {formatFecha(c.fechaFin)}
                            </span>
                          </div>
                          {monto && (
                            <p className="text-[11px] font-bold text-primary">{monto}</p>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1 bg-gradient-to-t from-black/20 to-transparent pointer-events-none">
                          <p className="text-[10px] font-bold text-white/90">CONVENIO</p>
                        </div>
                      </div>
                    )}

                    {/* Badge "Expirado" / "Activo" arriba derecha */}
                    <div
                      className={`absolute right-2 top-2 z-10 rounded-md border p-1 ${
                        estado === "ACTIVO"
                          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : estado === "EXPIRADO"
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                      title={tab.label}
                    >
                      {estado === "ACTIVO" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : estado === "EXPIRADO" ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Spinner overlay si está abriendo */}
                    {isOpening && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px]">
                        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-2 p-3 flex-1">
                    <p
                      className="text-sm font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2"
                      title={c.institucion}
                    >
                      {c.institucion}
                    </p>
                    <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Nº {c.numero}</span>
                      <span>Firma: {formatFecha(c.fechaInicio)}</span>
                      {monto && <span className="font-bold text-primary">{monto}</span>}
                    </div>

                    {attached && (
                      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <FileStatusIconToggle
                          value={
                            attached.fileStatus === "PENDIENTE" || attached.fileStatus === "INACTIVO"
                              ? (attached.fileStatus as FileStatus)
                              : "ACTIVO"
                          }
                          onChange={(s) => void handleAttachedDocumentFileStatus(attached.id, s)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConvenio(c.id);
                      }}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver detalles
                    </button>
                  </div>

                  {attached && (
                    <div
                      className="absolute right-2 bottom-2 rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Documento: ${attached.name}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-2 pt-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              Página <span className="text-primary">{page}</span> de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-primary hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Mostrando {total > 0 ? `${from}-${to}` : 0} de {total} convenios.
        </p>
      </main>
    </>
  );
};
