import React, { useState, useEffect, useRef } from "react";
import { backupsApi, downloadBackup, ApiBackup } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Toast } from "./ui";

export const SecurityPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [backups, setBackups] = useState<ApiBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; visible: boolean }>({ message: "", type: "success", visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  // Polling for backups in progress
  useEffect(() => {
    const hasInProgress = backups.some((b) => b.status === "in_progress");
    if (!hasInProgress) return;

    const interval = setInterval(() => {
      fetchBackups(false); // don't show loading spinner every 3s
    }, 3000);

    return () => clearInterval(interval);
  }, [backups]);

  const fetchBackups = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await backupsApi.list({ limit: 50 });
      setBackups(res.data);
    } catch (err) {
      console.error("Error fetching backups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBackup = async () => {
    try {
      setGenerating(true);
      await backupsApi.create({ name: "Manual Backup", type: "full" });
      showToast("Respaldo iniciado. Puede tardar unos minutos.", "success");
      fetchBackups();
    } catch (err: any) {
      console.error("Error generating backup:", err);
      const msg =
        err?.status === 403
          ? "No tienes permisos para generar respaldos."
          : "Error al generar el respaldo. Intenta más tarde.";
      showToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadLatest = async () => {
    const latestCompleted = backups.find(
      (b) => b.status === "completed" && b.filePath
    );
    if (!latestCompleted) {
      showToast("No hay respaldos completados para descargar.", "error");
      return;
    }
    try {
      await downloadBackup(
        latestCompleted.id,
        `backup_${new Date(latestCompleted.completedAt!).toISOString().split("T")[0]}.zip`
      );
    } catch (err) {
      console.error("Error downloading:", err);
      showToast("Error al descargar el archivo.", "error");
    }
  };

  const handleDownloadById = async (b: ApiBackup) => {
    try {
      await downloadBackup(
        b.id,
        `backup_${new Date(b.completedAt!).toISOString().split("T")[0]}.zip`
      );
    } catch (err) {
      console.error("Error downloading:", err);
      showToast("Error al descargar el archivo.", "error");
    }
  };

  // Build the 7 days week status
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysOfWeek = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    daysOfWeek.push(d);
  }

  const daysNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  const statusLabel: Record<string, { text: string; color: string }> = {
    completed: {
      text: "Completado",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    in_progress: {
      text: "En progreso",
      color:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    pending: {
      text: "Pendiente",
      color:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    failed: {
      text: "Fallido",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
  };

  const formatSize = (size: string | null) => {
    if (!size) return "—";
    const bytes = Number(size);
    if (isNaN(bytes) || bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#111318] dark:text-white flex-1 font-display">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8 px-6 py-10">
        <main className="flex-1 flex flex-col gap-8">
          {/* Hero Section */}
          <section className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-[#f0f2f4] dark:border-gray-800 overflow-hidden relative">
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left gap-4">
              <div className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm mr-1">
                  verified_user
                </span>{" "}
                Sistema Activo
              </div>
              <h1 className="text-[#111318] dark:text-white tracking-tight text-[32px] md:text-[40px] font-bold leading-tight">
                Tu oficina siempre segura
              </h1>
              <p className="text-[#616f89] dark:text-gray-400 text-lg max-w-2xl font-normal leading-relaxed">
                Acceso privado garantizado y recuperación de archivos ante
                cualquier error. Nos encargamos de que tu información legal esté
                resguardada las 24 horas.
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                {isAdmin && (
                  <button
                    onClick={handleGenerateBackup}
                    disabled={generating}
                    className="bg-primary/10 text-primary px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-primary/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {generating ? "sync" : "backup"}
                    </span>{" "}
                    {generating ? "Generando..." : "Generar Respaldo"}
                  </button>
                )}
                <button
                  onClick={handleDownloadLatest}
                  className="bg-primary text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-xl">
                    download
                  </span>{" "}
                  Descargar último respaldo
                </button>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 opacity-5 dark:opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-[300px]">
                security
              </span>
            </div>
          </section>

          {/* Backup Summary Section */}
          <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-[#f0f2f4] dark:border-gray-800 p-6">
            <h2 className="text-[#111318] dark:text-white text-xl font-bold px-2 pb-6">
              Resumen de respaldos (Últimos 7 días)
            </h2>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-4 px-2">
              {daysOfWeek.map((day, idx) => {
                const isToday = idx === 6;
                const dateKey = day.toISOString().split("T")[0];

                // Find if there's any completed backup that started on this day
                const hasBackup = backups.some((b) => {
                  if (b.status !== "completed" || !b.startedAt) return false;
                  return b.startedAt.split("T")[0] === dateKey;
                });

                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center gap-3 ${!hasBackup && !isToday ? "opacity-30" : ""}`}
                  >
                    <span
                      className={`text-xs font-medium uppercase tracking-widest ${isToday ? "text-primary font-bold" : "text-[#616f89]"}`}
                    >
                      {daysNames[day.getDay()]}
                    </span>
                    <div
                      className={`size-12 rounded-full flex items-center justify-center ${hasBackup
                        ? isToday
                          ? "bg-primary text-white ring-4 ring-primary/20"
                          : "bg-primary/10 text-primary"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                        }`}
                    >
                      <span className="material-symbols-outlined font-bold">
                        {hasBackup ? "check_circle" : "schedule"}
                      </span>
                    </div>
                    {isToday && (
                      <span className="text-[10px] text-primary font-bold">
                        HOY
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Backup History Table */}
          <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-[#f0f2f4] dark:border-gray-800 p-6">
            <h2 className="text-[#111318] dark:text-white text-xl font-bold px-2 pb-4">
              Historial de respaldos
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="material-symbols-outlined animate-spin text-primary text-3xl">
                  progress_activity
                </span>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-[#616f89] dark:text-gray-400">
                <span className="material-symbols-outlined text-5xl mb-2 block opacity-40">
                  cloud_off
                </span>
                <p className="font-medium">
                  No hay respaldos registrados aún.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[#616f89] dark:text-gray-400 text-left">
                      <th className="pb-3 px-2 font-semibold">Nombre</th>
                      <th className="pb-3 px-2 font-semibold">Tipo</th>
                      <th className="pb-3 px-2 font-semibold">Estado</th>
                      <th className="pb-3 px-2 font-semibold">Documentos</th>
                      <th className="pb-3 px-2 font-semibold">Tamaño</th>
                      <th className="pb-3 px-2 font-semibold">Fecha</th>
                      <th className="pb-3 px-2 font-semibold text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.slice(0, 10).map((b) => {
                      const st = statusLabel[b.status] ?? {
                        text: b.status,
                        color: "bg-gray-100 text-gray-600",
                      };
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3 px-2 font-medium text-[#111318] dark:text-white">
                            {b.name}
                          </td>
                          <td className="py-3 px-2 text-[#616f89] dark:text-gray-400 capitalize">
                            {b.type}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${st.color}`}
                            >
                              {st.text}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-[#616f89] dark:text-gray-400">
                            {b.documentsCount ?? "—"}
                          </td>
                          <td className="py-3 px-2 text-[#616f89] dark:text-gray-400">
                            {formatSize(b.size)}
                          </td>
                          <td className="py-3 px-2 text-[#616f89] dark:text-gray-400 whitespace-nowrap">
                            {b.startedAt
                              ? new Date(b.startedAt).toLocaleDateString(
                                "es-MX",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                              : "—"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {b.status === "completed" && b.filePath ? (
                              <button
                                onClick={() => handleDownloadById(b)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  download
                                </span>
                                Descargar
                              </button>
                            ) : b.status === "in_progress" ? (
                              <div className="flex flex-col gap-1 items-end w-full max-w-[120px] ml-auto">
                                <span className="inline-flex items-center gap-1 text-xs text-blue-500 font-medium">
                                  <span className="material-symbols-outlined text-sm animate-spin">
                                    progress_activity
                                  </span>
                                  Procesando {b.progress !== undefined ? `${b.progress}%` : ''}
                                </span>
                                {b.progress !== undefined && (
                                  <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-1.5 mt-1 overflow-hidden">
                                    <div
                                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                                      style={{ width: `${b.progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : b.status === "failed" ? (
                              <span className="text-xs text-red-500 font-medium">
                                {b.errorMessage ?? "Error"}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* "How it works" 3 Simple Steps */}
          <section className="py-4">
            <h2 className="text-[#111318] dark:text-white text-[22px] font-bold px-4 mb-8">
              ¿Cómo funciona nuestra seguridad?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-4 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold">
                  1
                </div>
                <h3 className="text-lg font-bold">Trabajas libremente</h3>
                <p className="text-[#616f89] dark:text-gray-400 text-sm leading-relaxed">
                  Escribes tus demandas y gestionas tus casos. El sistema
                  detecta cada palabra nueva que agregas a tus expedientes.
                </p>
              </div>
              <div className="flex flex-col gap-4 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold">
                  2
                </div>
                <h3 className="text-lg font-bold">
                  Sincronización instantánea
                </h3>
                <p className="text-[#616f89] dark:text-gray-400 text-sm leading-relaxed">
                  Cada cambio se guarda automáticamente al instante. Olvídate de
                  presionar "Guardar" o perder trabajo por un apagón.
                </p>
              </div>
              <div className="flex flex-col gap-4 p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold">
                  3
                </div>
                <h3 className="text-lg font-bold">Resguardo en la Bóveda</h3>
                <p className="text-[#616f89] dark:text-gray-400 text-sm leading-relaxed">
                  Tu información viaja encriptada hacia servidores de alta
                  seguridad, protegida bajo los más estrictos estándares
                  legales.
                </p>
              </div>
            </div>
          </section>
          {/* Trust Badges Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-primary">
                <span className="material-symbols-outlined text-3xl">
                  verified
                </span>
              </div>
              <div>
                <h4 className="font-bold text-[#111318] dark:text-white">
                  Acceso Privado
                </h4>
                <p className="text-sm text-[#616f89] dark:text-gray-400">
                  Sólo tú y los colaboradores que autorices tienen acceso a la
                  lectura de los expedientes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-green-600">
                <span className="material-symbols-outlined text-3xl">
                  history
                </span>
              </div>
              <div>
                <h4 className="font-bold text-[#111318] dark:text-white">
                  Recuperación Histórica
                </h4>
                <p className="text-sm text-[#616f89] dark:text-gray-400">
                  ¿Borraste algo por error? Podemos volver el tiempo atrás hasta
                  30 días en cualquier documento.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
};