import React, { useEffect } from "react";
import { ViewState } from "../types";

interface TermsPageProps {
  onNavigate: (view: ViewState) => void;
}

const legalP = "text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]";

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
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
            Términos de Servicio
          </h1>
          <p className="mt-4 text-xl text-[#616f89] dark:text-gray-400">
            Acuerdo de uso de la aplicación de escritorio AbogadoSoft para gestión documental colaborativa en nube privada.
          </p>
        </div>
        <div className="mb-16 overflow-hidden rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">article</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111318] dark:text-white">En pocas palabras</h2>
              <p className={`mt-2 text-lg font-medium leading-relaxed text-[#111318] dark:text-gray-200 ${legalP}`}>
                AbogadoSoft es una aplicación de escritorio (Electron + React) que permite a los abogados de la universidad gestionar documentos de forma colaborativa. Usted mantiene la propiedad de sus documentos; la aplicación ofrece sincronización nube/local, permisos granulares y papelera con recuperación.
              </p>
            </div>
          </div>
        </div>
        <article className="space-y-12">
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">1. Aceptación</h2>
            <p className={legalP}>
              Al utilizar AbogadoSoft usted acepta estos Términos de Servicio y la Política de Privacidad. El software está dirigido a abogados universitarios y personal administrativo. Si utiliza la aplicación en nombre de una institución o grupo, declara tener autoridad para vincularlos a estos términos.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">2. Uso del Software</h2>
            <p className={`mb-6 ${legalP}`}>
              AbogadoSoft concede un uso limitado, no exclusivo y revocable de la aplicación de gestión documental, incluyendo CRUD de archivos, compartir y asignar documentos, permisos (Lectura, Escritura, Admin), grupos de trabajo, gestión de convenios universidad-abogados, sincronización automática nube/local y modo offline.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  Uso Permitido
                </h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Gestión colaborativa de documentos (Word, PDF, Excel), convenios, documentos asignados, historial de versiones, exportar e imprimir. Uso en el ámbito universitario y legal para el que fue diseñada la aplicación.</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">cancel</span>
                  Restricciones
                </h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">No se permite uso para fines ilícitos, ingeniería inversa, ni acciones que comprometan la integridad del sistema o la confidencialidad de los datos de otros usuarios.</p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">3. Responsabilidades</h2>
            <p className={`mb-4 ${legalP}`}>
              Para un entorno seguro y profesional:
            </p>
            <ul className="list-none space-y-4 pl-0">
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">shield</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Cuenta:</strong> Usted es responsable de la confidencialidad de sus credenciales y de la actividad realizada bajo su cuenta (roles: abogado/admin o auxiliar/asistente).</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">description</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Contenido:</strong> Usted conserva la propiedad intelectual sobre sus documentos. AbogadoSoft no asume responsabilidad sobre la veracidad o legalidad del contenido que gestione.</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">update</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Papelera:</strong> Los documentos eliminados se conservan en papelera 30 días para recuperación antes de la eliminación definitiva.</span>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">4. Terminación</h2>
            <p className={legalP}>
              Puede dejar de usar la aplicación en cualquier momento. Tras la terminación, dispone de un periodo de 30 días para exportar sus documentos y datos antes de que se proceda a la eliminación definitiva en cumplimiento de la custodia documental.
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
