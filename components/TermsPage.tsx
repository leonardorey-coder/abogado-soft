import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ResponsibleIdentitySection } from "./legal/ResponsibleIdentitySection";
import { LegalConfigBanner } from "./LegalConfigBanner";
import { legalDocumentPath } from "../lib/legalRoutes";

const LEGAL_LAST_UPDATED = "8 de mayo de 2026";
const LEGAL_JURISDICTION = "Ciudad de México";

const legalP = "text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]";

export const TermsPage: React.FC = () => {
  const { search, pathname } = useLocation();
  const privacyHref = legalDocumentPath("privacidad", pathname, search);

  useEffect(() => {
    const el = document.getElementById("main-content");
    if (el) el.scrollTo({ top: 0, behavior: "auto" });
    else window.scrollTo(0, 0);
  }, [pathname, search]);

  return (
    <div className="min-h-full w-full flex-1 bg-slate-50 dark:bg-slate-900 text-[#111318] dark:text-white font-display">
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 py-8 sm:py-10 lg:py-12 pb-16 sm:pb-20">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-[#6b7280] dark:text-gray-400">
            Fecha de última actualización: {LEGAL_LAST_UPDATED}
          </p>
        </div>
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-[#111318] dark:text-white sm:text-5xl">
            Términos y condiciones de uso
          </h1>
          <p className="mt-4 text-xl text-[#616f89] dark:text-gray-400">
            Acuerdo de uso del servicio SIDOC (gestión documental colaborativa), con referencia a la LFPDPPP y al aviso de privacidad integral publicado en la misma plataforma.
          </p>
        </div>
        <LegalConfigBanner docLabel="texto de términos y condiciones" />
        <div className="mb-16 overflow-hidden rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">article</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111318] dark:text-white">En pocas palabras</h2>
              <p className={`mt-2 text-lg font-medium leading-relaxed text-[#111318] dark:text-gray-200 ${legalP}`}>
                SIDOC es una aplicación para gestionar documentos de forma colaborativa (incluidos permisos, grupos, convenios y registros de actividad según configuración). Usted conserva los derechos sobre su contenido; el Prestador conserva los derechos sobre el software y la marca. El tratamiento de datos personales se describe en la{" "}
                <Link to={privacyHref} className="text-primary font-semibold underline underline-offset-2">
                  Política de privacidad
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
        <ResponsibleIdentitySection />
        <article className="space-y-12 mt-12">
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">1. Objeto</h2>
            <p className={legalP}>
              Estos Términos regulan el acceso y uso del software y servicios en línea denominados en conjunto «SIDOC», en adelante el Servicio, puesto a disposición por el responsable del tratamiento indicado en el aviso de privacidad.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">2. Aceptación</h2>
            <p className={legalP}>
              Al crear una cuenta, marcar las casillas de aceptación en el registro o inicio de sesión y utilizar el Servicio, usted declara haber leído y aceptado estos Términos y el aviso de privacidad. Si actúa en representación de una persona moral, declara contar con facultades para obligarla.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">3. Cuenta y elegibilidad</h2>
            <p className={`mb-4 ${legalP}`}>
              Debe proporcionar datos veraces y mantener la confidencialidad de sus credenciales. Es responsable de la actividad bajo su cuenta. El Prestador puede suspender cuentas ante incumplimiento grave o riesgo para la seguridad.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">4. Uso del Servicio</h2>
            <p className={`mb-6 ${legalP}`}>
              Se le concede un uso limitado, no exclusivo y revocable del Servicio para gestión documental colaborativa (archivos, permisos, grupos, convenios, sincronización y funciones afines según la versión desplegada).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  Uso permitido
                </h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Gestión profesional o institucional conforme a la finalidad del Servicio y a la legislación aplicable, incluida la de protección de datos personales.</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">cancel</span>
                  Restricciones
                </h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Queda prohibido el uso ilícito, el acceso no autorizado a datos ajenos, la ingeniería inversa ilícita o la elusión de medidas de seguridad, salvo lo permitido por ley.</p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">5. Contenido y propiedad intelectual</h2>
            <p className={legalP}>
              Usted conserva los derechos sobre el contenido que cargue. El Prestador retiene los derechos sobre el software, marcas e interfaz. Usted otorga una licencia limitada para alojar, procesar, respaldar y mostrar su contenido solo en la medida necesaria para prestar el Servicio y cumplir obligaciones legales.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">6. Datos personales</h2>
            <p className={legalP}>
              El tratamiento se rige por el aviso de privacidad integral accesible en esta aplicación, el cual está estructurado para cubrir, entre otros extremos, el contenido mínimo del artículo 15 de la LFPDPPP. La vigilancia administrativa en la materia corresponde a la Secretaría Anticorrupción y Buen Gobierno en los términos de la propia ley y su reglamentación.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">7. Disponibilidad y modificaciones</h2>
            <p className={legalP}>
              Se procura mantener el Servicio operativo sin garantizar disponibilidad ininterrumpida. Pueden modificarse funcionalidades o estos Términos; los cambios sustanciales se comunicarán por medios razonables dentro de la plataforma o la documentación legal.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">8. Limitación de responsabilidad</h2>
            <p className={legalP}>
              En el máximo alcance permitido por la legislación mexicana aplicable, no se responde por daños indirectos o lucro cesante cuando su causa sea ajena al incumplimiento grave del Prestador. No se excluye responsabilidad donde la ley lo prohíba.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">9. Ley aplicable y jurisdicción</h2>
            <p className={legalP}>
              Rigen las leyes de los Estados Unidos Mexicanos. Salvo disposición legal en contrario, las partes se someten a la competencia de los tribunales competentes de{" "}
              <strong className="text-[#111318] dark:text-white">{LEGAL_JURISDICTION}</strong>, en la medida en que dicha cláusula sea válida.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">10. Terminación</h2>
            <p className={legalP}>
              Puede dejar de usar el Servicio en cualquier momento. Tras la baja, pueden aplicarse plazos de conservación o exportación descritos en la política de privacidad y en la configuración operativa del Prestador.
            </p>
          </section>
        </article>
        <div className="mt-16 sm:mt-20 border-t border-slate-200 dark:border-slate-700 pt-8">
          <Link
            to={privacyHref}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined">policy</span>
            Ver Política de privacidad
          </Link>
        </div>
      </div>
    </div>
  );
};
