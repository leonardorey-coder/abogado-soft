import React, { useState } from "react";

interface AdminAccessModalProps {
  documentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ADMIN_PIN = "1234";

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  documentName,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        onSuccess();
        onClose();
      } else {
        setError("Contraseña o PIN incorrecto.");
      }
      setLoading(false);
    }, 300);
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
        <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-2xl">lock</span>
            </div>
            <h2 className="text-xl font-bold text-[#111318] dark:text-white">
              Acceso completo al documento
            </h2>
          </div>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">
            Para obtener acceso completo a este documento (permisos de administrador) ingrese la contraseña o PIN de administrador.
          </p>
          {documentName && (
            <p className="text-[#616f89] dark:text-[#a0aec0] text-xs mt-2 truncate" title={documentName}>
              Documento: {documentName}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label htmlFor="admin-pin" className="block text-sm font-bold text-[#111318] dark:text-white mb-2">
              Contraseña o PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full min-h-[48px] px-4 rounded-xl border-2 border-[#dbdfe6] dark:border-[#2d3748] bg-gray-50 dark:bg-[#101622] text-[#111318] dark:text-white text-lg tracking-[0.3em]"
              maxLength={8}
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
              disabled={!pin.trim() || loading}
              className="px-5 py-2.5 font-bold bg-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined">verified_user</span>
              )}
              Verificar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
