import React from "react";
import { ViewState } from "../types";

interface LoginPageProps {
  onNavigate: (view: ViewState) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                balance
              </span>
            </div>
            <h2 className="text-gray-900 dark:text-white text-2xl font-bold tracking-tight">Abogadosoft</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 dark:text-gray-400 hidden sm:block">¿No tiene cuenta?</span>
            <button
              type="button"
              className="flex items-center justify-center rounded-lg h-11 px-6 border-2 border-primary text-primary hover:bg-primary/5 transition-colors font-bold text-sm"
              onClick={() => onNavigate(ViewState.REGISTER)}
            >
              Registrarse
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-[480px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 sm:p-12 text-center">
          <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl font-extrabold mb-4">
            Iniciar sesión
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            La autenticación con Supabase se conectará aquí. Por ahora puede volver al inicio o registrarse.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              className="rounded-lg h-12 px-6 bg-primary text-white font-bold hover:bg-blue-700 transition-colors"
              onClick={() => onNavigate(ViewState.DASHBOARD)}
            >
              Volver al inicio
            </button>
            <button
              type="button"
              className="rounded-lg h-12 px-6 border-2 border-primary text-primary font-bold hover:bg-primary/5 transition-colors"
              onClick={() => onNavigate(ViewState.REGISTER)}
            >
              Registrarse
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
