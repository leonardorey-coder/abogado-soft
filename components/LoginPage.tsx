import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithSupabase, signInWithGoogle } from "../lib/supabaseAuth";
import { useAuth } from "../contexts/AuthContext";
import { AuthHeader } from "./AuthHeader";



const inputClass =
  "block w-full h-16 pl-12 pr-4 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Ingrese su correo y contraseña.");
      return;
    }
    setLoading(true);
    const result = await signInWithSupabase(email.trim(), password);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setAuth(result.user, result.session);
    navigate('/');
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // El redirect a Google se maneja automáticamente.
    // Al volver, AuthContext detecta SIGNED_IN y sincroniza.
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col transition-colors duration-200 font-display">
      <AuthHeader
        message="¿No tiene cuenta?"
        buttonLabel="Registrarse"
        onButtonClick={() => navigate('/registro')}
      />

      <main className="flex w-full flex-1 pt-20">
        {/* Lado izquierdo: Gráfico/Hero (visible solo en pantallas grandes) */}
        <div className="hidden lg:flex flex-col justify-center w-1/2 p-16 relative overflow-hidden bg-slate-50 dark:bg-[#101622] border-r border-[#dbdfe6] dark:border-[#2d3748]">
          <div className="relative z-10 w-full max-w-xl mx-auto">
            <div className="bg-primary text-white p-3 rounded-xl mb-6 shadow-lg shadow-primary/20 inline-block">
              <span className="material-symbols-outlined text-[32px] block">balance</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black mb-6 text-slate-900 dark:text-white leading-tight">Gestione sus casos legales con máxima eficiencia</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-12">La plataforma intuitiva que organiza su expediente digital y agiliza sus flujos de revisión y aprobación.</p>

            {/* CSS App Mockup */}
            <div className="relative w-full h-[320px] perspective-[1200px]">
              <div className="absolute inset-x-8 top-0 h-[280px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 transform rotate-y-[-10deg] rotate-x-[5deg] rotate-z-[2deg] translate-x-4 p-6 flex flex-col gap-4 opacity-95 transition-all hover:rotate-y-[-2deg] hover:rotate-x-[2deg] hover:rotate-z-[0deg] hover:translate-x-2 duration-700 group cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-1/3 h-5 bg-slate-200 dark:bg-slate-700 rounded-md group-hover:bg-primary/20 transition-colors"></div>
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                    <span className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2 h-24 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                    <div className="w-8 h-8 rounded-md bg-green-100 dark:bg-green-900/30 mb-2"></div>
                    <div className="w-1/2 h-3 bg-slate-200 dark:bg-slate-700 rounded mb-1"></div>
                    <div className="w-3/4 h-2 bg-slate-100 dark:bg-slate-800 rounded"></div>
                  </div>
                  <div className="w-1/2 h-24 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                    <div className="w-8 h-8 rounded-md bg-yellow-100 dark:bg-yellow-900/30 mb-2"></div>
                    <div className="w-1/2 h-3 bg-slate-200 dark:bg-slate-700 rounded mb-1"></div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                      <div className="w-3/4 h-full bg-yellow-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="w-full h-12 bg-primary/5 dark:bg-primary/10 rounded-xl mt-auto flex items-center px-4 border border-primary/10">
                  <div className="w-4 h-4 rounded-full bg-primary/60"></div>
                  <div className="w-32 h-2.5 bg-primary/30 rounded ml-3"></div>
                </div>
              </div>
            </div>

            <div className="absolute top-[60%] -right-12 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-bounce shadow-primary/10 z-20" style={{ animationDuration: '3s' }}>
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Documento aprobado</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hace 2 minutos</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-1 pointer-events-none" />
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[120px] -z-1 pointer-events-none" />
        </div>

        {/* Lado derecho: Formulario */}
        <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 sm:px-6 bg-white dark:bg-[#1a212f] overflow-y-auto min-h-[calc(100vh-80px)]">
          <div className="w-full max-w-[420px]">
            <div className="flex flex-col mb-6 text-center lg:text-left">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-1">
                Bienvenido a SIDOC
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-medium">
                Ingrese sus credenciales para acceder a su oficina.
              </p>
            </div>

            <div className="bg-transparent border-0 md:bg-white md:dark:bg-slate-800 md:rounded-2xl md:shadow-xl md:border md:border-slate-200 md:dark:border-slate-700 md:p-8 p-4 pt-0">
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || loading}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-100">
                    {googleLoading ? "Conectando…" : "Continuar con Google"}
                  </span>
                </button>
              </div>

              <div className="relative mb-6 flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                <span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 font-medium text-sm">O use su correo</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-base font-semibold text-slate-700 dark:text-slate-200" htmlFor="login-email">
                    Su correo electrónico
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <input
                      id="login-email"
                      className="block w-full h-12 pl-12 pr-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-base focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="ejemplo@correo.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-base font-semibold text-slate-700 dark:text-slate-200" htmlFor="login-password">
                    Su contraseña
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl">lock</span>
                    </div>
                    <input
                      id="login-password"
                      className="block w-full h-12 pl-12 pr-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-base focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-white text-lg font-bold h-12 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2 text-base">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Entrando…
                        </>
                      ) : (
                        <>
                          Entrar a mi Oficina
                          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">login</span>
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
                <Link
                  to="/registro"
                  className="text-primary dark:text-primary/90 font-semibold text-base hover:underline transition-all"
                >
                  ¿No tiene cuenta? Regístrese aquí
                </Link>
                <button
                  type="button"
                  className="text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
            </div>

            <footer className="mt-6 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
              <p>© 2026 SIDOC. Sistema integral de documentos y convenios.</p>
            </footer>
          </div>
        </div>
      </main>

      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden opacity-50 dark:opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
      </div>
    </div>
  );
};
