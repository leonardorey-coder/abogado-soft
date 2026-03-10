import React, { useState } from "react";
import { Document } from "../types";

interface ShareModalProps {
  document: Document;
  onClose: () => void;
}

import { getShareableDocumentFile } from '../lib/api';

export const ShareModal: React.FC<ShareModalProps> = ({ document, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/doc/${document.id}` : "";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSystemShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        setSharing(true);
        // Intentar obtener el archivo para compartirlo
        const file = await getShareableDocumentFile(document.id, document.name);

        let shareData: ShareData = {
          title: document.name,
          text: `Compartir documento: ${document.name}`,
        };

        // Si el navegador soporta compartir el archivo lo enviamos
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        } else {
          // Fallback a solo enviar la URL si no soporta archivo
          shareData.url = shareUrl;
        }

        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          alert("Error al compartir el archivo. Es posible que tu navegador no soporte compartir documentos.");
        }
      } finally {
        setSharing(false);
      }
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
        className="bg-white dark:bg-[#1a212f] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
          <h2 className="text-xl font-bold text-[#111318] dark:text-white">Compartir documento</h2>
          <p className="text-[#616f89] dark:text-[#a0aec0] mt-1 text-sm truncate" title={document.name}>
            {document.name}
          </p>
        </div>

        <div className="p-6 flex flex-col gap-6">
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
