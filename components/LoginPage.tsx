import React, { useState } from "react";
import { ViewState } from "../types";
import { signInWithSupabase } from "../lib/supabaseAuth";
import { AuthHeader } from "./AuthHeader";

interface LoginPageProps {
  onNavigate: (view: ViewState) => void;
}

const inputClass =
  "block w-full h-16 pl-12 pr-4 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg focus:ring-0 focus:border-primary transition-all placeholder:text-slate-400";

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
    onNavigate(ViewState.DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col transition-colors duration-200 font-display">
      <AuthHeader
        message="¿No tiene cuenta?"
        buttonLabel="Registrarse"
        onButtonClick={() => onNavigate(ViewState.REGISTER)}
      />

      <main className="flex flex-col items-center justify-center flex-1 pt-20 mt-8 py-12 px-6">
        <div className="w-full max-w-[520px]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary text-white p-3 rounded-xl mb-4 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[40px] block">balance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white text-center leading-tight">
            Bienvenido a Abogadosoft
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg text-center">
            Su oficina legal digital, simple y segura.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-10">
          <div className="mb-8">
            <button
              type="button"
              className="w-full h-16 flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-xl font-semibold text-slate-700 dark:text-slate-100">Continuar con Google</span>
            </button>
          </div>

          <div className="relative mb-8 flex items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            <span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 font-medium text-sm">O use su correo</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-lg font-semibold text-slate-700 dark:text-slate-200" htmlFor="login-email">
                Su correo electrónico
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <input
                  id="login-email"
                  className={inputClass}
                  placeholder="ejemplo@correo.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-lg font-semibold text-slate-700 dark:text-slate-200" htmlFor="login-password">
                Su contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <input
                  id="login-password"
                  className={inputClass}
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white text-xl font-bold h-16 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Entrando…" : "Entrar a mi Oficina"}
                {!loading && <span className="material-symbols-outlined">login</span>}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center gap-4">
            <button
              type="button"
              className="text-primary dark:text-primary/90 font-semibold text-lg hover:underline transition-all"
              onClick={() => onNavigate(ViewState.REGISTER)}
            >
              ¿No tiene cuenta? Regístrese aquí
            </button>
            <button
              type="button"
              className="text-slate-400 dark:text-slate-500 text-sm hover:text-slate-600 transition-all"
            >
              ¿Olvidó su contraseña?
            </button>
          </div>
        </div>

        <footer className="mt-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          <p>© 2026 Abogadosoft. Diseñado para abogados modernos.</p>
        </footer>
        </div>
      </main>

      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden opacity-50 dark:opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
      </div>
    </div>
  );
};
