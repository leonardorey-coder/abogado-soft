import React, { useState } from "react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../lib/constants";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseAuth";

interface CompleteProfilePageProps {
  onNavigate: (view: ViewState) => void;
}

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

type UserRole = "admin" | "asistente";
type GroupOption = "join" | "create";

const inputClass =
  "flex w-full rounded-lg text-gray-900 dark:text-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 h-14 pl-12 pr-4 text-lg placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export const CompleteProfilePage: React.FC<CompleteProfilePageProps> = ({
  onNavigate,
}) => {
  const { user, setAuth, refreshUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [groupOption, setGroupOption] = useState<GroupOption>("join");
  const [inviteCode, setInviteCode] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedRole) {
      setError("Seleccione su tipo de usuario.");
      return;
    }

    if (groupOption === "join" && !inviteCode.trim()) {
      setError("Ingrese el código de invitación del grupo.");
      return;
    }

    if (groupOption === "create" && !newGroupName.trim()) {
      setError("Ingrese el nombre del grupo de trabajo.");
      return;
    }

    setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Sesión expirada. Inicie sesión de nuevo.");
        setLoading(false);
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // 1. Actualizar rol del usuario
      const roleRes = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!roleRes.ok) {
        const err = await roleRes.json().catch(() => ({}));
        throw new Error(
          err.error ?? "Error actualizando el tipo de usuario."
        );
      }

      // 2. Unirse a grupo o crear uno nuevo
      if (groupOption === "join") {
        const joinRes = await fetch(`${API_URL}/groups/join`, {
          method: "POST",
          headers,
          body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
        });

        if (!joinRes.ok) {
          const err = await joinRes.json().catch(() => ({}));
          throw new Error(
            err.error ?? "Código de invitación inválido o grupo no encontrado."
          );
        }
      } else {
        const createRes = await fetch(`${API_URL}/groups`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: newGroupName.trim(),
            description: newGroupDescription.trim() || undefined,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Error creando el grupo de trabajo.");
        }
      }

      // 3. Refrescar datos del usuario (ahora tendrá grupo → needsProfileSetup = false)
      await refreshUser();

      // El useEffect en App.tsx detectará que needsProfileSetup=false y redirigirá al dashboard
    } catch (err: any) {
      setError(err.message ?? "Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: UserRole; label: string; description: string; icon: string }[] = [
    {
      value: "admin",
      label: ROLE_LABELS.admin,
      description: "Acceso completo al sistema. Gestiona documentos, grupos y usuarios.",
      icon: "gavel",
    },
    {
      value: "asistente",
      label: ROLE_LABELS.asistente,
      description: "Acceso restringido. Colabora en documentos asignados por el abogado.",
      icon: "support_agent",
    },
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      {/* Header simple */}
      <header className="h-16 flex items-center px-6 bg-white dark:bg-[#1a212f] border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-lg">
            <span className="material-symbols-outlined text-xl">balance</span>
          </div>
          <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            AbogadoSoft
          </span>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center pt-12 pb-20 px-4">
        <div className="w-full max-w-[580px]">
          {/* Progreso */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className={`flex items-center justify-center size-8 rounded-full text-sm font-bold transition-colors ${
                step >= 1
                  ? "bg-primary text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}
            >
              1
            </div>
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step >= 2 ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
            <div
              className={`flex items-center justify-center size-8 rounded-full text-sm font-bold transition-colors ${
                step >= 2
                  ? "bg-primary text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}
            >
              2
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-gray-900 dark:text-white text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
              {step === 1 ? "¿Cuál es su rol?" : "Únase a un grupo de trabajo"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base">
              {step === 1
                ? "Seleccione su tipo de usuario para configurar sus permisos."
                : "Ingrese con un código de invitación o cree su propio grupo."}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-8">
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* ─── Paso 1: Seleccionar rol ─── */}
              {step === 1 && (
                <div className="space-y-4">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSelectedRole(r.value)}
                      className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                        selectedRole === r.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-lg ${
                          selectedRole === r.value
                            ? "bg-primary text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl">
                          {r.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {r.label}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {r.description}
                        </p>
                      </div>
                      <div
                        className={`mt-1 size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedRole === r.value
                            ? "border-primary bg-primary"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selectedRole === r.value && (
                          <span className="material-symbols-outlined text-white text-sm">
                            check
                          </span>
                        )}
                      </div>
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={!selectedRole}
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    className="w-full mt-6 h-14 bg-primary text-white text-lg font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {/* ─── Paso 2: Grupo ─── */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Tabs */}
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setGroupOption("join");
                        setError(null);
                      }}
                      className={`flex-1 py-3 text-sm font-bold transition-colors ${
                        groupOption === "join"
                          ? "bg-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base align-middle mr-1">
                        group_add
                      </span>
                      Unirse con código
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupOption("create");
                        setError(null);
                      }}
                      className={`flex-1 py-3 text-sm font-bold transition-colors ${
                        groupOption === "create"
                          ? "bg-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base align-middle mr-1">
                        add_circle
                      </span>
                      Crear grupo nuevo
                    </button>
                  </div>

                  {groupOption === "join" ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-gray-900 dark:text-white text-base font-bold">
                          Código de invitación
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                            vpn_key
                          </span>
                          <input
                            className={inputClass + " uppercase tracking-widest"}
                            placeholder="Ej. A1B2C3D4E5F6"
                            type="text"
                            value={inviteCode}
                            onChange={(e) =>
                              setInviteCode(e.target.value.toUpperCase())
                            }
                            maxLength={12}
                            disabled={loading}
                          />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Solicite el código al administrador de su grupo de
                          trabajo.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-gray-900 dark:text-white text-base font-bold">
                          Nombre del grupo
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                            groups
                          </span>
                          <input
                            className={inputClass}
                            placeholder="Ej. Despacho García & Asociados"
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-gray-900 dark:text-white text-base font-bold">
                          Descripción{" "}
                          <span className="text-gray-400 font-normal">
                            (opcional)
                          </span>
                        </label>
                        <textarea
                          className="flex w-full rounded-lg text-gray-900 dark:text-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 text-base placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                          placeholder="Descripción breve del grupo de trabajo"
                          rows={3}
                          value={newGroupDescription}
                          onChange={(e) =>
                            setNewGroupDescription(e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setError(null);
                      }}
                      disabled={loading}
                      className="flex-1 h-14 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-base font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-[2] h-14 bg-primary text-white text-lg font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-xl">
                            progress_activity
                          </span>
                          Configurando…
                        </>
                      ) : (
                        "Completar registro"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 flex items-start gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="material-symbols-outlined text-primary text-lg mt-0.5">
              info
            </span>
            <p>
              Puede cambiar su rol y grupo de trabajo en cualquier momento desde
              la sección de Seguridad.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
