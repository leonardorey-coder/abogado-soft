import React from "react";
import { ViewState } from "../types";

interface SecurityPageProps {
  onNavigate: (view: ViewState) => void;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-background-light dark:bg-background-dark text-[#111318] dark:text-white min-h-screen font-display">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#f0f2f4] dark:border-gray-800 bg-white dark:bg-background-dark px-10 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-4 text-[#111318] dark:text-white cursor-pointer"
            onClick={() => onNavigate(ViewState.DASHBOARD)}
          >
            <div className="size-6 text-primary">
              <span className="material-symbols-outlined text-3xl">gavel</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">
              Abogadosoft
            </h2>
          </div>
          <nav className="hidden md:flex items-center gap-9">
            <a
              className="text-sm font-medium leading-normal hover:text-primary transition-colors cursor-pointer"
              onClick={() => onNavigate(ViewState.DASHBOARD)}
            >
              Inicio
            </a>
            <a
              className="text-sm font-medium leading-normal hover:text-primary transition-colors cursor-pointer"
              onClick={() => onNavigate(ViewState.AGREEMENTS)}
            >
              Convenios
            </a>
            <a
              className="text-sm font-medium leading-normal hover:text-primary transition-colors cursor-pointer"
              onClick={() => onNavigate(ViewState.ACTIVITY_LOG)}
            >
              Bitácora
            </a>
            <a
              className="text-sm font-semibold leading-normal text-primary border-b-2 border-primary cursor-pointer"
            >
              Seguridad
            </a>
          </nav>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          <label className="hidden lg:flex flex-col min-w-40 !h-10 max-w-64">
            <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
              <div className="text-[#616f89] flex border-none bg-[#f0f2f4] dark:bg-gray-800 items-center justify-center pl-4 rounded-l-xl">
                <span className="material-symbols-outlined text-[20px]">
                  search
                </span>
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#111318] dark:text-white focus:outline-0 focus:ring-0 border-none bg-[#f0f2f4] dark:bg-gray-800 focus:border-none h-full placeholder:text-[#616f89] px-4 rounded-l-none pl-2 text-base font-normal"
                placeholder="Buscar expediente..."
              />
            </div>
          </label>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20"
            data-alt="User profile avatar placeholder"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCfQ3DIH8Mo48jLWJDKBWVQTTFEk6yF_wke6M0JeljbBbeixoMjNjvNWKpeAddjwZYua4wAXh7s5WxY9qdoWtiZrKrBHRMk0MuCLTtWprh8QwY_IGC-lulHDUfYxN0bmnTKGPQPaM5ArBAUPgiiFpJygvBNGFwmGLmHvJ5VOzfA8eoOWcsuVxUFzB-aZn04Hv-DcDEBeREeTtwMMOCznQQLna52mIQ_Ku5UZwX_JC1yBVcFtcHTWLqJA5ggAk_ZNOaiEpmTo0PXbN0")',
            }}
          ></div>
        </div>
      </header>
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8 px-6 py-10">
        {/* Main Content Area */}
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
                <button className="bg-primary text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-primary/20">
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
              {/* Day Items */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Lun
                </span>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Mar
                </span>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Mie
                </span>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Jue
                </span>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Vie
                </span>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest text-primary font-bold">
                  Sab
                </span>
                <div className="size-12 rounded-full bg-primary flex items-center justify-center text-white ring-4 ring-primary/20">
                  <span className="material-symbols-outlined font-bold">
                    check_circle
                  </span>
                </div>
                <span className="text-[10px] text-primary font-bold">HOY</span>
              </div>
              <div className="flex flex-col items-center gap-3 opacity-30">
                <span className="text-xs font-medium text-[#616f89] uppercase tracking-widest">
                  Dom
                </span>
                <div className="size-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
              </div>
            </div>
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
                <h3 className="text-lg font-bold">Sincronización instantánea</h3>
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
      {/* Footer Area */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-10 py-8 bg-white dark:bg-background-dark">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[#616f89] text-sm">
            <span className="material-symbols-outlined text-lg">copyright</span>
            2023 Abogadosoft - Gestión Legal Segura
          </div>
          <div className="flex gap-6 text-sm text-[#616f89]">
            <a className="hover:text-primary transition-colors" href="#">
              Términos de Servicio
            </a>
            <a className="hover:text-primary transition-colors" href="#">
              Política de Privacidad
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};