import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  FileText,
  Table,
  Download,
  Share2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Tag,
  ChevronRight,
} from "lucide-react";
import { documentsApi, downloadDocument, API_URL, type ApiDocument } from "../lib/api";
import { sanitizeDocHtml, escapeHtmlText } from "../lib/sanitize";
import { getDocumentRoute } from "../lib/routes";
import { useNavigate } from "react-router-dom";

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentPreviewPanelProps {
  document: ApiDocument | null;
  onClose: () => void;
  onShare?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(s: string | number): string {
  const bytes = typeof s === "string" ? parseInt(s, 10) : s;
  if (isNaN(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeColor(type: string) {
  switch (type?.toUpperCase()) {
    case "DOCX":
    case "DOC":
      return { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", Icon: FileText };
    case "PDF":
      return { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", Icon: FileText };
    case "XLSX":
    case "XLS":
      return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", Icon: Table };
    default:
      return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500", Icon: FileText };
  }
}

// ─── Preview body component ─────────────────────────────────────────────────

interface PreviewBodyProps {
  doc: ApiDocument;
}

const PreviewBody: React.FC<PreviewBodyProps> = ({ doc }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [iframeSrcdoc, setIframeSrcdoc] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  const docType = doc.type?.toUpperCase();
  const isPDF = docType === "PDF";
  const isDOCX = docType === "DOCX" || docType === "DOC";
  const isXLSX = docType === "XLSX" || docType === "XLS";

  const MAX_FILE_SIZE_MB = 15;
  const sizeBytes = typeof doc.size === "string" ? parseInt(doc.size, 10) : Number(doc.size);
  const isTooBig = sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setBlobUrl(null);
      setIframeSrcdoc(null);

      // Cleanup previous blob URL
      if (prevBlobUrl.current) {
        URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }

      try {
        // ── Authenticated file fetch helper ──────────────────────────────
        const fetchFileBlob = async (): Promise<Blob> => {
          const { getAccessToken } = await import("../lib/auth");
          const token = await getAccessToken();
          const res = await fetch(`${API_URL}/documents/${doc.id}/file`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        };

        // ── PDF → blob URL (browser renders natively, full layout) ───────
        if (isPDF && !isTooBig) {
          const blob = await fetchFileBlob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          prevBlobUrl.current = url;
          setBlobUrl(url);
        }

        // ── DOCX → mammoth HTML rendered in iframe with Word-like CSS ────
        else if (isDOCX && !isTooBig) {
          const result = await documentsApi.getContent(doc.id);
          if (cancelled) return;

          // Inject Word-like typography + image rendering CSS into the iframe document
          const srcdoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #ffffff;
    color: #1a1a1a;
    font-family: 'Calibri', 'Segoe UI', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.5;
  }
  body {
    padding: 28px 36px 40px;
    max-width: 680px;
    margin: 0 auto;
  }
  p { margin-bottom: 0.6em; orphans: 3; widows: 3; }
  h1 { font-size: 1.5em; font-weight: 700; margin: 0.8em 0 0.4em; }
  h2 { font-size: 1.25em; font-weight: 700; margin: 0.7em 0 0.35em; }
  h3 { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; }
  h4, h5, h6 { font-weight: 600; margin: 0.5em 0 0.25em; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
    font-size: 0.92em;
  }
  th, td {
    border: 1px solid #d0d0d0;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f2f2f2; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.6em auto;
    border-radius: 2px;
  }
  ul, ol { padding-left: 1.6em; margin-bottom: 0.6em; }
  li { margin-bottom: 0.25em; }
  blockquote {
    border-left: 3px solid #ccc;
    margin: 0.6em 0 0.6em 0.5em;
    padding-left: 0.8em;
    color: #555;
  }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  a { color: #1a56db; text-decoration: none; }
  /* mammoth-specific: list bullets */
  .list-paragraph { padding-left: 1.6em; }
  /* pointer-events off so the backdrop-click closes the panel */
  body { pointer-events: none; }
</style>
</head>
<body>${sanitizeDocHtml(result.html)}</body>
</html>`;
          setIframeSrcdoc(srcdoc);
        }

        // ── XLSX → SheetJS → styled HTML table in iframe ─────────────────
        else if (isXLSX && !isTooBig) {
          const result = await documentsApi.getXlsxData(doc.id);
          if (cancelled) return;

          // Build a styled spreadsheet-like table
          const colHeaders = result.columns.map((c: any) =>
            `<th style="background:#217346;color:#fff;font-weight:700;padding:5px 10px;white-space:nowrap;border:1px solid #1a5e38;font-size:11px;">${escapeHtmlText(String(c.name ?? ""))}</th>`
          ).join('');

          const srcdoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background:#f4f6f8; font-family: 'Calibri','Segoe UI',Arial,sans-serif; height:100%; }
  body { padding: 12px; pointer-events: none; }
  .sheet-wrap { background:#fff; border-radius:6px; overflow:auto; box-shadow:0 1px 4px rgba(0,0,0,.12); max-height:100%; }
  table { border-collapse: collapse; min-width:100%; }
  .sheet-title {
    background:#1d6f42; color:#fff; font-weight:700; font-size:12px;
    padding:6px 12px; letter-spacing:.02em;
  }
  .row-num-col { background:#f2f2f2; color:#555; font-size:10px; text-align:center; padding:4px 6px; border:1px solid #d0d3d4; min-width:28px; }
</style>
</head>
<body>
<div class="sheet-wrap">
  <div class="sheet-title">📊 ${escapeHtmlText(doc.name)}</div>
  <table>
    <thead><tr><th class="row-num-col">#</th>${colHeaders}</tr></thead>
    <tbody>
      ${result.rows.map((row: any, ri: number) => {
        const cells = result.columns.map((col: any) => {
          const val = row.cells?.[col.id] ?? '';
          return `<td style="padding:4px 9px;border:1px solid #d0d3d4;font-size:11px;white-space:nowrap;background:${ri % 2 === 0 ? '#fff' : '#f0f7f2'};">${escapeHtmlText(String(val))}</td>`;
        }).join('');
        return `<tr><td class="row-num-col">${ri + 1}</td>${cells}</tr>`;
      }).join('')}
    </tbody>
  </table>
</div>
</body>
</html>`;
          setIframeSrcdoc(srcdoc);
        }

      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar la vista previa");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [doc.id, docType]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/40">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Generando vista previa…</p>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center bg-slate-50 dark:bg-slate-800/40">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vista previa no disponible</p>
        <p className="text-xs text-slate-400">{error}</p>
      </div>
    );
  }

  // ─── Too big ──────────────────────────────────────────────────────────────
  if (isTooBig) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center bg-slate-50 dark:bg-slate-800/40">
        <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Archivo grande ({formatBytes(doc.size)})
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Las vistas previas están disponibles para archivos menores de {MAX_FILE_SIZE_MB} MB.
        </p>
      </div>
    );
  }

  // ─── PDF: native browser rendering via blob URL ───────────────────────────
  if (isPDF && blobUrl) {
    return (
      <div className="flex-1 overflow-hidden bg-slate-700">
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
          className="w-full h-full border-0"
          title="Vista previa PDF"
          style={{ minHeight: 0 }}
        />
      </div>
    );
  }

  // ─── DOCX / XLSX: iframe with srcdoc ─────────────────────────────────────
  if (iframeSrcdoc) {
    return (
      <div className="flex-1 overflow-hidden bg-[#f4f6f8] dark:bg-slate-800/50">
        <iframe
          srcDoc={iframeSrcdoc}
          className="w-full h-full border-0"
          title="Vista previa del documento"
          sandbox=""
          style={{ minHeight: 0 }}
        />
      </div>
    );
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/40">
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Vista previa no disponible para este formato.
      </p>
    </div>
  );
};


// ─── Main Panel ────────────────────────────────────────────────────────────

export const DocumentPreviewPanel: React.FC<DocumentPreviewPanelProps> = ({
  document: doc,
  onClose,
  onShare,
}) => {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    try {
      setDownloading(true);
      await downloadDocument(doc.id, doc.name);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [doc]);

  const handleOpen = useCallback(() => {
    if (!doc) return;
    onClose();
    navigate(getDocumentRoute(doc.id, doc.type));
  }, [doc, navigate, onClose]);

  if (!doc) return null;

  const { bg, text, Icon } = getTypeColor(doc.type);

  return (
    <>
      {/* Backdrop (transparent, captures outside click) */}
      <div className="fixed inset-0 z-[100]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-[101] w-[420px] max-w-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700/60 shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
            <Icon className={`w-5 h-5 ${text}`} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
              {doc.name}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {doc.type?.toUpperCase()} · {formatBytes(doc.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Cerrar vista previa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata strip */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          {doc.owner && (
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3 shrink-0" />
              {doc.owner.name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            {formatDate(doc.updatedAt)}
          </span>
          {doc.fileStatus && (
            <span className={`flex items-center gap-1.5 font-semibold ${
              doc.fileStatus === "ACTIVO" ? "text-green-600 dark:text-green-400"
              : doc.fileStatus === "PENDIENTE" ? "text-amber-600 dark:text-amber-400"
              : "text-slate-400"
            }`}>
              <Tag className="w-3 h-3 shrink-0" />
              {doc.fileStatus}
            </span>
          )}
        </div>

        {/* Preview body */}
        <PreviewBody doc={doc} />

        {/* Action bar */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/60 px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => { onClose(); onShare(); }}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center py-2 px-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm transition-colors"
            aria-label="Cerrar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};
