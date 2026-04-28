import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerWithSupabase, signInWithGoogle } from "../lib/supabaseAuth";
import { useAuth } from "../contexts/AuthContext";
import { AuthHeader } from "./AuthHeader";
import { AppBrand } from "./AppBrand";



const inputClass =
  "flex w-full rounded-lg text-gray-900 dark:text-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 h-16 pl-12 pr-4 text-xl placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
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
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <AuthHeader
        message="¿Ya tiene una cuenta?"
        buttonLabel="Iniciar sesión"
        onButtonClick={() => navigate('/login')}
      />

      <main className="flex w-full flex-1 pt-20">
        {/* Lado izquierdo: Gráfico/Hero (visible solo en pantallas grandes) */}
        <div className="hidden lg:flex flex-col justify-center w-1/2 p-16 relative overflow-hidden bg-slate-50 dark:bg-[#101622] border-r border-[#dbdfe6] dark:border-[#2d3748]">
          <div className="relative z-10 w-full max-w-xl mx-auto">
            <div className="mb-6 inline-block">
              <AppBrand size="lg" wordmark="always" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-black mb-6 text-slate-900 dark:text-white leading-tight">Únase a la nueva era legal</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-12">Cree su cuenta en segundos y empiece a organizar sus casos, colaborar con su equipo y asegurar su información con encriptación de grado bancario.</p>

            {/* CSS App Mockup (Diferente diseño para registro) */}
            <div className="relative w-full h-[320px] perspective-[1200px]">
              <div className="absolute inset-x-8 top-0 h-[280px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 transform rotate-y-[10deg] rotate-x-[5deg] rotate-z-[-2deg] -translate-x-4 p-6 flex flex-col gap-4 opacity-95 transition-all hover:rotate-y-[2deg] hover:rotate-x-[2deg] hover:rotate-z-[0deg] hover:-translate-x-2 duration-700 group cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <div className="w-6 h-6 border-4 border-primary rounded-full border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
                  </div>
                  <div className="flex-1">
                    <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      </div>
                      <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute top-[60%] -left-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-pulse shadow-primary/10 z-20" style={{ animationDuration: '4s' }}>
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">shield</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Seguridad Total</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Datos encriptados</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-1 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[120px] -z-1 pointer-events-none" />
        </div>

        {/* Lado derecho: Formulario */}
        <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 sm:px-6 bg-white dark:bg-[#1a212f] overflow-y-auto min-h-[calc(100vh-80px)]">
          <div className="w-full max-w-[440px]">
            <div className="flex flex-col mb-4 text-center lg:text-left">
              <div className="mb-3 flex justify-center lg:justify-start">
                <AppBrand size="md" wordmark="always" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-1">
                Cree su cuenta
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium">
                Simplifique la gestión de sus documentos legales hoy mismo.
              </p>
            </div>

            <div className="bg-transparent border-0 md:bg-white md:dark:bg-slate-800 md:rounded-2xl md:shadow-xl md:border md:border-slate-200 md:dark:border-slate-700 md:p-6 p-4 pt-0">
              <div className="mb-5">
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
                  className="w-full h-11 flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-100">
                    {googleLoading ? "Conectando…" : "Registrarse con Google"}
                  </span>
                </button>
              </div>

              <div className="relative mb-5 flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                <span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 font-medium text-xs">O regístrese con su correo</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nombre completo</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors text-xl">person</span>
                    <input
                      className="block w-full h-11 pl-11 pr-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="Ej. Juan Pérez"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Correo electrónico</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors text-xl">mail</span>
                    <input
                      className="block w-full h-11 pl-11 pr-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="nombre@ejemplo.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cree una contraseña</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors text-xl">lock</span>
                    <input
                      className="block w-full h-11 pl-11 pr-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="Mínimo 8 caracteres"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      <span className="material-symbols-outlined text-[18px]">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmar contraseña</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors text-xl">lock</span>
                    <input
                      className="block w-full h-11 pl-11 pr-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="Repita su contraseña"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                    >
                      <span className="material-symbols-outlined text-[18px]">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Las contraseñas no coinciden.</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-white text-base font-bold h-11 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Registrando…
                        </>
                      ) : (
                        <>
                          Crear mi cuenta
                          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[20px]">arrow_forward</span>
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </button>
                </div>
              </form>

            </div>

            <div className="mt-4 text-center space-y-3">
              <p className="text-slate-500 dark:text-slate-400 text-xs px-4">
                Al registrarse, acepta nuestros{" "}
                <button type="button" className="text-primary hover:underline font-semibold transition-all">
                  Términos de Servicio
                </button>{" "}
                y{" "}
                <button type="button" className="text-primary hover:underline font-semibold transition-all">
                  Política de Privacidad
                </button>
                .
              </p>
              <div className="flex justify-center gap-6 pt-2">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  <span className="text-xs font-medium">Soporte 24/7</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">cloud_done</span>
                  <span className="text-xs font-medium">Respaldo seguro</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};
