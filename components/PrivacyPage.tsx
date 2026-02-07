import React, { useEffect } from "react";
import { ViewState } from "../types";

interface PrivacyPageProps {
  onNavigate: (view: ViewState) => void;
}

const legalP = "text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]";

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
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
            Política de Privacidad
          </h1>
          <p className="mt-4 text-xl text-[#616f89] dark:text-gray-400">
            Privacidad y seguridad de los datos en la aplicación de gestión documental AbogadoSoft (plataforma desktop, nube privada).
          </p>
        </div>
        <div className="mb-16 overflow-hidden rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">security</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111318] dark:text-white">En pocas palabras</h2>
              <p className={`mt-2 text-lg font-medium leading-relaxed text-[#111318] dark:text-gray-200 ${legalP}`}>
                Recopilamos solo lo necesario para el servicio. Los documentos se almacenan de forma cifrada; el acceso se controla por permisos (Lectura, Escritura, Admin). Aplicamos encriptación en reposo, autenticación 2FA opcional, logs de auditoría y backup automático diario.
              </p>
            </div>
          </div>
        </div>
        <article className="space-y-12">
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">1. Información que recopilamos</h2>
            <p className={`mb-4 ${legalP}`}>
              AbogadoSoft recopila la mínima información necesaria para la gestión documental colaborativa en nube privada:
            </p>
            <ul className="list-none space-y-4 pl-0">
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">check_circle</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Datos de cuenta:</strong> Identificador, correo electrónico, nombre, rol (admin/abogado o asistente/auxiliar), avatar opcional, fechas de creación y último acceso.</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">check_circle</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Documentos:</strong> Archivos que usted sube (path local y URL en nube). Se almacenan cifrados en reposo. Los metadatos (propietario, permisos, versiones) se usan solo para el funcionamiento del servicio.</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">check_circle</span>
                <span className={legalP}><strong className="text-[#111318] dark:text-white">Logs de auditoría:</strong> Registros de actividad para prevenir accesos no autorizados, cumplir con auditoría y mejorar la estabilidad del sistema.</span>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">2. Seguridad</h2>
            <p className={`mb-4 ${legalP}`}>
              Medidas de seguridad aplicadas:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Encriptación en reposo</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Documentos cifrados en tránsito y en reposo para proteger la confidencialidad de los expedientes.</p>
              </div>
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Autenticación 2FA opcional</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Opción de segundo factor para reforzar el acceso a la cuenta.</p>
              </div>
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Logs de auditoría</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Registro de acciones relevantes para trazabilidad y seguridad.</p>
              </div>
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Backup automático diario</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Copias de respaldo para garantizar la disponibilidad y recuperación ante fallos.</p>
              </div>
            </div>
            <p className={`mt-4 ${legalP}`}>
              El control de acceso (permisos por documento y por grupo: Lectura, Escritura, Admin) permite que solo las personas autorizadas vean o editen cada documento.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">3. Uso de la Información</h2>
            <p className={legalP}>
              La información se utiliza exclusivamente para la prestación del servicio de AbogadoSoft: sincronización nube/local, permisos, grupos, convenios y mejora de la estabilidad. No se comparte, vende ni alquila datos personales o de documentos a terceros con fines publicitarios ni para entrenar modelos de IA con su información confidencial.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">4. Sus Derechos</h2>
            <p className={`mb-4 ${legalP}`}>Usted mantiene el control sobre su información y puede:</p>
            <ul className="list-disc space-y-2 pl-6 marker:text-primary text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]">
              <li>Acceder a los datos personales que mantengamos sobre su cuenta.</li>
              <li>Solicitar rectificación o eliminación permanente de sus datos.</li>
              <li>Exportar sus documentos en formatos estándar en cualquier momento.</li>
              <li>Revocar el consentimiento para el tratamiento de sus datos.</li>
            </ul>
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
