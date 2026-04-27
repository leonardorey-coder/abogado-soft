import React, { useState, useEffect, useCallback } from "react";
import { Document, DocumentShare, ShareMethod } from "../types";
import { getShareableDocumentFile, documentsApi, ApiDocumentShare, documentPdfsApi, getDocumentPdfFileUrl } from '../lib/api';
import { Mail, MessageCircle, Link2, Share2, Clock, User, FileDown } from "lucide-react";

interface ShareModalProps {
  document: Document;
  onClose: () => void;
  onShareLogged?: () => void;
  onPdfConverted?: () => void;
  /** Función para generar el PDF del documento. Si se provee, se usará para el botón "Compartir como PDF" */
  generatePdf?: () => Promise<Blob>;
}

const shareMethodIcons: Record<ShareMethod, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  link: <Link2 className="w-3.5 h-3.5" />,
  system: <Share2 className="w-3.5 h-3.5" />,
  other: <Share2 className="w-3.5 h-3.5" />,
};

const shareMethodLabels: Record<ShareMethod, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  link: "Enlace",
  system: "Sistema",
  other: "Otro",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Tipos de documentos compatibles con la conversión a PDF via mammoth
const PDF_COMPATIBLE_TYPES = ['docx', 'doc'];

function isPdfCompatible(document: Document): boolean {
  const type = document.type?.toLowerCase();
  if (type && PDF_COMPATIBLE_TYPES.includes(type)) return true;
  // También revisar extensión del nombre
  const ext = document.name?.split('.').pop()?.toLowerCase();
  return !!(ext && PDF_COMPATIBLE_TYPES.includes(ext));
}

async function shareFileViaElectron(
  file: File,
  options: { title: string; text: string; url?: string; x?: number; y?: number },
): Promise<boolean> {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  if (!api?.isElectron || typeof api.shareFile !== "function") return false;

  const result = await api.shareFile({
    fileName: file.name,
    buffer: await file.arrayBuffer(),
    ...options,
  });
  if (!result.ok) throw new Error(result.error || "No se pudo abrir el menú de compartir");
  return true;
}

export const ShareModal: React.FC<ShareModalProps> = ({ document, onClose, onShareLogged, onPdfConverted, generatePdf }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [shareHistory, setShareHistory] = useState<DocumentShare[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [manualContact, setManualContact] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const canShareAsPdf = isPdfCompatible(document);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/documento/${document.id}` : "";

  const loadShareHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await documentsApi.getShares(document.id);
      setShareHistory(res.shares.map((s: ApiDocumentShare) => ({
        sharedWith: s.sharedWith,
        shareMethod: s.shareMethod,
        sharedAt: s.sharedAt,
        sharedBy: s.sharedBy,
      })));
    } catch (err) {
      console.error("Error cargando historial de shares:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [document.id]);

  useEffect(() => {
    void loadShareHistory();
  }, [loadShareHistory]);

  const logShare = async (sharedWith: string, method: ShareMethod) => {
    try {
      await documentsApi.share(document.id, { sharedWith, shareMethod: method });
      await loadShareHistory();
      onShareLogged?.();
    } catch (err) {
      console.error("Error registrando share:", err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Registrar que se copió el enlace
      await logShare("Enlace copiado", "link");
    } catch {
      setCopied(false);
    }
  };

  const handleSystemShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      setSharing(true);
      // Intentar obtener el archivo para compartirlo
      const file = await getShareableDocumentFile(document.id, document.name);
      const title = document.name;
      const text = `Compartir documento: ${document.name}`;

      const sharedWithElectron = await shareFileViaElectron(file, {
        title,
        text,
        url: shareUrl,
        x: event.clientX,
        y: event.clientY,
      });

      if (!sharedWithElectron) {
        if (typeof navigator === "undefined" || !navigator.share) {
          throw new Error("Tu navegador no soporta compartir documentos.");
        }

        const shareData: ShareData = { title, text };
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        } else {
          shareData.url = shareUrl;
        }

        await navigator.share(shareData);
      }

      await logShare("Compartido via sistema", "system");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        alert("Error al compartir el archivo. Es posible que tu navegador no soporte compartir documentos.");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleShareAsPdf = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sharingPdf) return;
    setPdfError(null);
    setSharingPdf(true);
    try {
      let pdfBlob: Blob | null = null;

      if (generatePdf) {
        // Usar el generador provisto por el padre (DocumentEditor con SuperDoc)
        pdfBlob = await generatePdf();
      } else {
        // Fallback: renderizar el HTML del documento y capturar con html2canvas
        const { html } = await documentsApi.getContent(document.id);
        const container = window.document.createElement('div');
        container.style.cssText = [
          'position:fixed', 'left:-9999px', 'top:0',
          'width:794px', 'background:white', 'color:black',
          'font-family:Georgia,serif', 'font-size:12pt',
          'line-height:1.5', 'padding:48px', 'box-sizing:border-box',
        ].join(';');
        container.innerHTML = html;
        window.document.body.appendChild(container);

        const images = Array.from(container.querySelectorAll('img'));
        await Promise.allSettled(images.map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        ));

        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');
        const canvas = await html2canvas(container, { scale: 1.5, useCORS: true, logging: false, windowWidth: 794, backgroundColor: '#ffffff' });
        window.document.body.removeChild(container);

        const pageW = 595.28;
        const pageH = 841.89;
        const imgH = (canvas.height * pageW) / canvas.width;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        let remaining = imgH;
        let first = true;
        while (remaining > 0) {
          if (!first) pdf.addPage();
          first = false;
          const srcY = (imgH - remaining) / imgH * canvas.height;
          const sliceH = Math.min(remaining, pageH);
          const sliceCanvasH = Math.max(1, Math.round(sliceH / imgH * canvas.height));
          const slice = window.document.createElement('canvas');
          slice.width = canvas.width;
          slice.height = sliceCanvasH;
          const ctx = slice.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvasH, 0, 0, canvas.width, sliceCanvasH);
          pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH);
          remaining -= pageH;
        }
        pdfBlob = pdf.output('blob');
      }

      if (!pdfBlob) throw new Error('No se pudo generar el PDF');

      // Subir el PDF al servidor y enlazarlo al documento
      const pdfRecord = await documentPdfsApi.upload(document.id, pdfBlob, 'share');
      onPdfConverted?.();

      const pdfName = pdfRecord.name;
      const pdfFile = new File([pdfBlob], pdfName, { type: 'application/pdf' });

      const title = pdfName;
      const text = `Compartir documento: ${pdfName}`;
      const sharedWithElectron = await shareFileViaElectron(pdfFile, {
        title,
        text,
        url: getDocumentPdfFileUrl(document.id, pdfRecord.id),
        x: event.clientX,
        y: event.clientY,
      });

      const supportsFileShare =
        !sharedWithElectron &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] });

      if (supportsFileShare) {
        await navigator.share({ title, text, files: [pdfFile] });
      } else if (!sharedWithElectron) {
        const pdfUrl = getDocumentPdfFileUrl(document.id, pdfRecord.id);
        if (typeof navigator.share === 'function') {
          await navigator.share({ title, text, url: pdfUrl });
        } else {
          const blobUrl = URL.createObjectURL(pdfBlob);
          const a = window.document.createElement('a');
          a.href = blobUrl;
          a.download = pdfName;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }
      }

      await logShare('Compartido como PDF', 'system');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[ShareAsPdf]', err);
        setPdfError('No se pudo generar el PDF. Inténtalo de nuevo.');
      }
    } finally {
      setSharingPdf(false);
    }
  };


  const handleManualShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const contact = manualContact.trim();
    if (!contact) return;

    setSavingManual(true);
    try {
      // Detectar el método basado en el contenido
      let method: ShareMethod = "other";
      if (contact.includes("@")) {
        method = "email";
      } else if (/^\+?\d{10,}$/.test(contact.replace(/[\s-]/g, ""))) {
        method = "whatsapp";
      }

      await logShare(contact, method);
      setManualContact("");
    } catch (err) {
      console.error("Error registrando contacto:", err);
    } finally {
      setSavingManual(false);
    }
  };

  const inputButtonClass = "min-h-[48px] px-4 py-3 rounded-xl text-sm font-bold transition-opacity flex items-center justify-center gap-2";
  const inputClass = "min-h-[48px] flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-[#dbdfe6] dark:border-[#2d3748] bg-gray-50 dark:bg-[#101622] text-[#111318] dark:text-white text-sm";
  const buttonActionClass = "min-w-[7rem] shrink-0 " + inputButtonClass;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#1a212f] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
          <h2 className="text-xl font-bold text-[#111318] dark:text-white">Compartir documento</h2>
          <p className="text-[#616f89] dark:text-[#a0aec0] mt-1 text-sm truncate" title={document.name}>
            {document.name}
          </p>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">Enlace del documento</label>
            <div className="flex gap-2 items-stretch">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className={buttonActionClass + " bg-primary text-white hover:opacity-90"}
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">Compartir con el sistema</label>
            <button
              type="button"
              onClick={handleSystemShare}
              disabled={sharing}
              className={`w-full ${inputButtonClass} border-2 border-[#dbdfe6] dark:border-[#2d3748] bg-slate-50 dark:bg-[#101622] hover:bg-slate-100 dark:hover:bg-[#1a212f] text-[#111318] dark:text-white ${sharing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <span className={`material-symbols-outlined ${sharing ? 'animate-spin' : ''}`}>
                {sharing ? 'progress_activity' : 'share'}
              </span>
              {sharing ? 'Preparando archivo...' : 'Abrir menú de compartir'}
            </button>
          </div>

          {/* Compartir como PDF — solo visible para docx/doc */}
          {canShareAsPdf && (
            <div>
              <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">
                Compartir como PDF
              </label>
              <button
                type="button"
                onClick={handleShareAsPdf}
                disabled={sharingPdf}
                className={`w-full ${inputButtonClass} border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 ${sharingPdf ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {sharingPdf ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <FileDown className="w-5 h-5" />
                )}
                {sharingPdf ? 'Generando PDF...' : 'Compartir como PDF'}
              </button>
              {pdfError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {pdfError}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">
              Registrar contacto manualmente
            </label>
            <form onSubmit={handleManualShare} className="flex gap-2 items-stretch">
              <input
                type="text"
                placeholder="Email o teléfono del destinatario"
                value={manualContact}
                onChange={(e) => setManualContact(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={!manualContact.trim() || savingManual}
                className={buttonActionClass + " bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"}
              >
                {savingManual ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">person_add</span>
                )}
                Agregar
              </button>
            </form>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Registra a quién compartiste este documento para tener un historial.
            </p>
          </div>

          {/* Historial de shares */}
          <div>
            <label className="block text-sm font-bold text-[#111318] dark:text-white mb-2">
              Historial de compartidos ({shareHistory.length})
            </label>
            <div className="border-2 border-[#dbdfe6] dark:border-[#2d3748] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {loadingHistory ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  <p className="text-sm mt-1">Cargando historial...</p>
                </div>
              ) : shareHistory.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                  <Share2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Este documento no ha sido compartido aún.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700/60">
                  {shareHistory.map((share, idx) => (
                    <li key={idx} className="p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        share.shareMethod === "email" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                        share.shareMethod === "whatsapp" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                        share.shareMethod === "link" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {shareMethodIcons[share.shareMethod]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {share.sharedWith}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(share.sharedAt)}
                          {share.sharedBy && (
                            <>
                              <span className="mx-1">•</span>
                              <User className="w-3 h-3" />
                              {share.sharedBy.name}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {shareMethodLabels[share.shareMethod]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

    </div>
  );
};
