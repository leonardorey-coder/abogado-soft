import React, { useState } from "react";
import { accessPinApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface AdminAccessModalProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  documentId,
  documentName,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // ─── Estado para GENERAR PIN (admin) ──────────────────────────────────
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinExpiry, setPinExpiry] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // ─── Estado para CANJEAR PIN (auxiliar) ───────────────────────────────
  const [pin, setPin] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ─── Generar PIN (admin) ──────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await accessPinApi.generate(documentId);
      setGeneratedPin(res.pin);
      setPinExpiry(new Date(res.expiresAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }));
    } catch (err: any) {
      setError(err.message || "Error generando PIN");
    } finally {
      setGenerating(false);
    }
  };

  // ─── Canjear PIN (auxiliar) ───────────────────────────────────────────
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeeming(true);
    setError("");
    try {
      await accessPinApi.redeem(documentId, pin);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "PIN inválido, expirado o ya utilizado");
    } finally {
      setRedeeming(false);
    }
  };

  // ─── Copiar PIN ───────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-2xl">
                {isAdmin ? "key" : "lock"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#111318] dark:text-white">
              {isAdmin ? "Generar PIN de Acceso" : "Pedir Acceso Completo"}
            </h2>
          </div>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">
            {isAdmin
              ? "Genera un PIN de un solo uso para otorgar acceso de administrador a un auxiliar."
              : "Ingresa el PIN proporcionado por el abogado para obtener acceso completo."}
          </p>
          {documentName && (
            <p className="text-[#616f89] dark:text-[#a0aec0] text-xs mt-2 truncate" title={documentName}>
              Documento: <strong>{documentName}</strong>
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {isAdmin ? (
            /* ─── Vista Admin: Generar PIN ───────────────────────────── */
            generatedPin ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 w-full text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    PIN de acceso
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-black tracking-[0.4em] text-primary font-mono">
                      {generatedPin}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Copiar PIN"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {copied ? "check" : "content_copy"}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    Expira a las {pinExpiry}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 w-full">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">info</span>
                    Este PIN es de un solo uso. Una vez que el auxiliar lo ingrese, se invalidará automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Generar nuevo PIN
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl">vpn_key</span>
                </div>
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Genera un PIN numérico de 6 dígitos. El auxiliar tendrá <strong>15 minutos</strong> para ingresarlo y obtener permisos completos de administrador en este documento.
                </p>
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full px-5 py-3 font-bold bg-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined">key</span>
                  )}
                  {generating ? "Generando..." : "Generar PIN"}
                </button>
              </div>
            )
          ) : (
            /* ─── Vista Auxiliar: Canjear PIN ─────────────────────────── */
            success ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  ¡Acceso otorgado!
                </p>
                <p className="text-sm text-slate-500">
                  Ahora tienes permisos de administrador en este documento.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRedeem} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="admin-pin" className="block text-sm font-bold text-[#111318] dark:text-white mb-2">
                    PIN de acceso
                  </label>
                  <input
                    id="admin-pin"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => {
                      // Solo permitir dígitos, máximo 6
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setPin(v);
                      setError("");
                    }}
                    placeholder="000000"
                    className="w-full min-h-[52px] px-4 rounded-xl border-2 border-[#dbdfe6] dark:border-[#2d3748] bg-gray-50 dark:bg-[#101622] text-[#111318] dark:text-white text-2xl tracking-[0.5em] text-center font-mono font-bold"
                    maxLength={6}
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-lg">error</span>
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pin.length !== 6 || redeeming}
                    className="px-5 py-2.5 font-bold bg-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                  >
                    {redeeming ? (
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined">verified_user</span>
                    )}
                    Verificar
                  </button>
                </div>
              </form>
            )
          )}

          {/* Close button for admin after generating */}
          {isAdmin && (
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
