import React, { useState } from "react";
import { ViewState } from "../types";
import { registerWithSupabase, signInWithGoogle } from "../lib/supabaseAuth";
import { useAuth } from "../contexts/AuthContext";
import { AuthHeader } from "./AuthHeader";

interface RegisterPageProps {
  onNavigate: (view: ViewState) => void;
}

const inputClass =
  "flex w-full rounded-lg text-gray-900 dark:text-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 h-16 pl-12 pr-4 text-xl placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { setAuth } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Complete todos los campos.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const result = await registerWithSupabase({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setAuth(result.user, result.session);
    onNavigate(ViewState.DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <AuthHeader
        message="¿Ya tiene una cuenta?"
        buttonLabel="Iniciar sesión"
        onButtonClick={() => onNavigate(ViewState.LOGIN)}
      />

      <main className="flex flex-col items-center justify-center pt-20 mt-8 py-12 px-4">
        <div className="w-full max-w-[640px]">
          <div className="text-center mb-10">
            <h1 className="text-gray-900 dark:text-white text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
              Cree su cuenta de Abogado
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Simplifique la gestión de sus documentos legales hoy mismo.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-8 sm:p-12">
              <div className="mb-10">
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    setGoogleLoading(true);
                    const result = await signInWithGoogle();
                    setGoogleLoading(false);
                    if (result.error) setError(result.error);
                  }}
                  disabled={googleLoading || loading}
                  className="flex w-full items-center justify-center gap-4 rounded-lg h-16 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Registrarse con Google
                </button>
              </div>

              <div className="relative mb-10">
                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm uppercase">
                  <span className="bg-white dark:bg-gray-900 px-4 text-gray-500 font-semibold tracking-wider">
                    O regístrese con su correo
                  </span>
                </div>
              </div>

              <form className="space-y-8" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-gray-900 dark:text-white text-lg font-bold leading-normal">Nombre completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">person</span>
                    <input
                      className={inputClass}
                      placeholder="Ej. Juan Pérez"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-gray-900 dark:text-white text-lg font-bold leading-normal">Correo electrónico</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                    <input
                      className={inputClass}
                      placeholder="nombre@ejemplo.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-gray-900 dark:text-white text-lg font-bold leading-normal">Cree una contraseña</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                    <input
                      className={inputClass + " pr-12"}
                      placeholder="Mínimo 8 caracteres"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-gray-900 dark:text-white text-lg font-bold leading-normal">Confirmar contraseña</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                    <input
                      className={inputClass + " pr-12"}
                      placeholder="Repita su contraseña"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      <span className="material-symbols-outlined">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400">Las contraseñas no coinciden.</p>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex w-full items-center justify-center gap-3 rounded-lg h-20 bg-primary text-white text-2xl font-bold leading-normal shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <span>{loading ? "Registrando…" : "Comenzar a usar Abogadosoft"}</span>
                    {!loading && (
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 flex items-center justify-center gap-3 border-t border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-green-600 text-3xl">verified_user</span>
              <p className="text-gray-700 dark:text-gray-300 font-medium text-lg text-center">
                Sus datos y documentos estarán siempre protegidos
              </p>
            </div>
          </div>

          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm px-4">
              Al registrarse, acepta nuestros{" "}
              <button type="button" className="text-primary underline font-semibold" onClick={() => onNavigate(ViewState.TERMS)}>
                Términos de Servicio
              </button>{" "}
              y{" "}
              <button type="button" className="text-primary underline font-semibold" onClick={() => onNavigate(ViewState.PRIVACY)}>
                Política de Privacidad
              </button>
              .
            </p>
            <div className="flex justify-center gap-8 pt-4">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="material-symbols-outlined text-sm">support_agent</span>
                <span className="text-sm">Soporte 24/7</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="material-symbols-outlined text-sm">cloud_done</span>
                <span className="text-sm">Respaldo en la nube</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
