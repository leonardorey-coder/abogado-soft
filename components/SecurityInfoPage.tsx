import React, { useEffect } from "react";
import { ViewState } from "../types";

interface SecurityInfoPageProps {
  onNavigate: (view: ViewState) => void;
}

const legalP = "text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]";

export const SecurityInfoPage: React.FC<SecurityInfoPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="flex-grow bg-background-light dark:bg-background-dark font-display">
      <div className="mx-auto max-w-[800px] px-6 py-12 lg:py-20">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-[#6b7280] dark:text-gray-400">
            Fecha de última actualización: 27 de enero de 2026
          </p>
        </div>
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-[#111318] dark:text-white sm:text-5xl">
            Seguridad de su Información
          </h1>
          <p className="mt-4 text-xl text-[#616f89] dark:text-gray-400">
            Confidencialidad e integridad de sus expedientes en la aplicación de gestión documental AbogadoSoft.
          </p>
        </div>
        <div className="mb-16 overflow-hidden rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111318] dark:text-white">En pocas palabras</h2>
              <p className={`mt-2 text-lg font-medium leading-relaxed text-[#111318] dark:text-gray-200 ${legalP}`}>
                Encriptación de documentos en reposo, autenticación 2FA opcional, logs de auditoría y backup automático diario. Solo usted y quienes autorice tienen acceso a sus documentos mediante permisos granulares (Lectura, Escritura, Admin).
              </p>
            </div>
          </div>
        </div>
        <article className="space-y-16">
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <span className="material-symbols-outlined text-3xl">enhanced_encryption</span>
              </div>
              <h2 className="text-2xl font-bold text-[#111318] dark:text-white">1. Encriptación en reposo</h2>
            </div>
            <p className={legalP}>
              Los documentos se cifran en reposo en nuestros servidores y en tránsito durante la sincronización nube/local. Así se garantiza que la información sea ilegible para terceros no autorizados.
            </p>
          </section>
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <span className="material-symbols-outlined text-3xl">cloud_sync</span>
              </div>
              <h2 className="text-2xl font-bold text-[#111318] dark:text-white">2. Backup automático diario</h2>
            </div>
            <p className={`mb-6 ${legalP}`}>
              El sistema realiza copias de seguridad automáticas cada día para garantizar la continuidad y la recuperación ante fallos.
            </p>
            <div className="rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-6">
              <h3 className="font-bold text-[#111318] dark:text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Historial de versiones
              </h3>
              <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">
                Se mantienen las últimas 10 versiones de cada documento para recuperar información en caso de eliminaciones accidentales o errores de edición.
              </p>
            </div>
          </section>
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <span className="material-symbols-outlined text-3xl">lock_person</span>
              </div>
              <h2 className="text-2xl font-bold text-[#111318] dark:text-white">3. Acceso y autenticación</h2>
            </div>
            <p className={`mb-4 ${legalP}`}>
              El acceso se controla mediante permisos granulares por documento y por grupo: Lectura, Escritura y Admin. Además se ofrece autenticación de dos factores (2FA) opcional como capa adicional de seguridad al iniciar sesión.
            </p>
          </section>
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <span className="material-symbols-outlined text-3xl">description</span>
              </div>
              <h2 className="text-2xl font-bold text-[#111318] dark:text-white">4. Logs de auditoría</h2>
            </div>
            <p className={legalP}>
              Se registran las acciones relevantes en el sistema para trazabilidad y auditoría, permitiendo detectar accesos no autorizados y cumplir con buenas prácticas de seguridad.
            </p>
          </section>
        </article>
        <div className="mt-20 border-t border-[#e5e7eb] dark:border-[#2d3748] pt-8">
          <button
            type="button"
            onClick={() => onNavigate(ViewState.DASHBOARD)}
            className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Volver al inicio
          </button>
        </div>
      </div>
    </main>
  );
};
