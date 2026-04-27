import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { getShareableDocumentFile } from "../lib/api";
import { Skeleton } from "./ui";

const PREVIEW_PAPER_WIDTH = 816;
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

interface CloudDocThumbnailProps {
  doc: { id: string; name: string; type: string };
}

export function CloudDocThumbnail({ doc }: CloudDocThumbnailProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [docxReady, setDocxReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    const target = wrapperRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const target = wrapperRef.current;
    if (!target) return;
    const update = () => {
      const w = target.clientWidth;
      if (w > 0) setScale(w / PREVIEW_PAPER_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setPdfUrl(null);
    setXlsxHtml(null);
    setTextPreview(null);
    setDocxReady(false);
    setUnsupported(false);
    setFailed(false);
    if (docxRef.current) docxRef.current.innerHTML = "";

    async function load() {
      try {
        setLoading(true);
        const file = await getShareableDocumentFile(doc.id, doc.name);
        if (cancelled) return;

        if (file.size > MAX_PREVIEW_BYTES) {
          if (!cancelled) setUnsupported(true);
          return;
        }

        const ext = doc.name.split(".").pop()?.toLowerCase() ?? doc.type.toLowerCase();

        if (doc.type === "PDF" || ext === "pdf") {
          createdUrl = URL.createObjectURL(file);
          if (!cancelled) setPdfUrl(createdUrl);
          return;
        }

        if (doc.type === "XLSX" || ext === "xlsx" || ext === "xls") {
          const XLSX = await import("xlsx");
          const buffer = await file.arrayBuffer();
          if (cancelled) return;
          const wb = XLSX.read(buffer, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          if (!ws) throw new Error("Hoja vacía");
          const html = XLSX.utils.sheet_to_html(ws, { editable: false });
          if (!cancelled) setXlsxHtml(html);
          return;
        }

        if (doc.type === "DOCX" || ext === "docx" || ext === "doc") {
          await new Promise((res) => requestAnimationFrame(res));
          if (cancelled) return;
          if (!docxRef.current) {
            if (!cancelled) setFailed(true);
            return;
          }
          docxRef.current.innerHTML = "";
          const { renderAsync } = await import("docx-preview");
          await renderAsync(file, docxRef.current, undefined, {
            className: "cloud-docx-preview",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: true,
            ignoreFonts: false,
            breakPages: false,
            useBase64URL: true,
            experimental: true,
          });
          if (!cancelled) setDocxReady(true);
          return;
        }

        if (ext === "txt" || ext === "rtf") {
          if (!cancelled) setTextPreview((await file.text()).slice(0, 4000));
          return;
        }

        if (!cancelled) setUnsupported(true);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc.id, doc.name, doc.type, visible]);

  const isDocx = doc.type === "DOCX" || doc.name.toLowerCase().endsWith(".doc");
  const showSkeleton = !visible || loading;

  return (
    <div
      ref={wrapperRef}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
    >
      {visible && doc.type === "PDF" && pdfUrl && (
        <iframe
          title={`Vista previa de ${doc.name}`}
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          loading="lazy"
          className="absolute inset-0 h-full w-full bg-white"
        />
      )}

      {visible && isDocx && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white text-slate-900"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
        >
          <div ref={docxRef} />
        </div>
      )}

      {visible && xlsxHtml && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white p-4 text-[12px] text-slate-900 [&_table]:w-auto [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: xlsxHtml }}
        />
      )}

      {visible && textPreview && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left whitespace-pre-wrap bg-white p-6 font-mono text-[12px] leading-tight text-slate-900"
          style={{ width: PREVIEW_PAPER_WIDTH, transform: `scale(${scale})` }}
        >
          {textPreview}
        </div>
      )}

      {(failed || unsupported) && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900">
          <FileText
            className={`h-12 w-12 opacity-25 ${
              doc.type === "PDF" ? "text-red-500" : doc.type === "XLSX" ? "text-emerald-500" : "text-blue-500"
            }`}
          />
          <span className="text-[10px] font-medium text-slate-400">
            {unsupported ? "Archivo muy grande" : "Sin vista previa"}
          </span>
        </div>
      )}

      {showSkeleton && !failed && !unsupported && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
      {visible && !loading && isDocx && !docxReady && !failed && !unsupported && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}

      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1 bg-gradient-to-t from-black/20 to-transparent pointer-events-none">
        <p className="text-[10px] font-bold text-white/90">{doc.type}</p>
      </div>
    </div>
  );
}
