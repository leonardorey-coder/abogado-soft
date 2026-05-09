import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ResponsibleIdentitySection } from "./legal/ResponsibleIdentitySection";
import { LegalConfigBanner } from "./LegalConfigBanner";
import { legalDocumentPath } from "../lib/legalRoutes";

const LEGAL_LAST_UPDATED = "8 de mayo de 2026";

const legalP = "text-[1.125rem] leading-[1.75] text-[#374151] dark:text-[#d1d5db]";

export const PrivacyPage: React.FC = () => {
  const { search, pathname } = useLocation();
  const termsHref = legalDocumentPath("terminos", pathname, search);

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
            Política de privacidad
          </h1>
          <p className="mt-4 text-xl text-[#616f89] dark:text-gray-400">
            Aviso de privacidad integral para titulares en México (LFPDPPP, DOF 20 de marzo de 2025 y reformas posteriores).
          </p>
        </div>
        <LegalConfigBanner docLabel="aviso de privacidad" />
        <div className="mb-16 overflow-hidden rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">security</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111318] dark:text-white">En pocas palabras</h2>
              <p className={`mt-2 text-lg font-medium leading-relaxed text-[#111318] dark:text-gray-200 ${legalP}`}>
                Tratamos datos personales con finalidades informadas, medidas de seguridad proporcionales al riesgo y mecanismos para ARCO, revocación del consentimiento y limitación del uso o divulgación. El consentimiento puede revocarse en cualquier momento sin efectos retroactivos, conforme al artículo 7 de la LFPDPPP. Los documentos se protegen con controles de acceso y, según despliegue, cifrado y respaldos.
              </p>
            </div>
          </div>
        </div>
        <ResponsibleIdentitySection />
        <article className="space-y-12 mt-12">
          <section>
            <h2 className="mb-4 text-2xl font-bold text-[#111318] dark:text-white">
              Contenido mínimo del aviso (artículo 15 LFPDPPP)
            </h2>
            <p className={`mb-6 ${legalP}`}>
              El aviso integral que sigue desarrolla, de forma accesible, los extremos que la ley exige «al menos» en el aviso de privacidad:
            </p>
            <ol className="list-decimal space-y-4 pl-6 marker:font-bold marker:text-primary text-[1.05rem] leading-relaxed text-[#374151] dark:text-[#d1d5db]">
              <li>
                <strong className="text-[#111318] dark:text-white">I. Identidad y domicilio del responsable:</strong> sección anterior y datos de contacto publicados mediante variables de entorno en el despliegue productivo.
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">II. Datos personales sometidos a tratamiento:</strong> sección «Datos personales tratados», con distinción de datos sensibles cuando aplique.
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">III. Finalidades del tratamiento:</strong> sección «Finalidades», distinguiendo las que requieren consentimiento cuando la ley lo exija.
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">IV. Opciones y medios para limitar el uso o divulgación:</strong> sección «Limitación del uso o divulgación» y el canal ARCO.
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">V. Mecanismos, medios y procedimientos para ejercer los derechos ARCO:</strong> secciones «Derechos ARCO», «Revocación del consentimiento» y «Procedimiento de protección de derechos».
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">VI. Cambios al aviso:</strong> sección «Cambios al aviso».
              </li>
            </ol>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Modalidad de puesta a disposición (artículo 16)</h2>
            <p className={legalP}>
              Cuando los datos se obtienen por medios electrónicos u otra tecnología, la ley prevé un aviso simplificado con al menos las fracciones I a IV del artículo 15 e indicación del sitio donde consultar el aviso integral. En SIDOC el tratamiento es en línea: este texto es el{" "}
              <strong className="text-[#111318] dark:text-white">aviso de privacidad integral</strong>, accesible de forma permanente en las rutas públicas y de aplicación previstas en el producto, y las casillas en registro e inicio de sesión remiten a él.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Finalidades del tratamiento</h2>
            <p className={`mb-4 ${legalP}`}>
              <strong className="text-[#111318] dark:text-white">Primarias (necesarias para la relación con el titular):</strong> crear y administrar la cuenta; autenticar y mantener sesiones seguras; operar la gestión documental (almacenamiento, permisos, versiones, asignaciones, convenios y funciones afines); cumplir obligaciones legales; registrar actividad en bitácoras para seguridad y trazabilidad.
            </p>
            <p className={legalP}>
              <strong className="text-[#111318] dark:text-white">Secundarias:</strong> las que su organización defina y comunique conforme a la ley; si no hay ninguna, no se tratarán datos para fines adicionales no informados.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Datos personales tratados</h2>
            <p className={`mb-4 ${legalP}`}>
              De forma enunciativa: identificadores de cuenta (nombre, correo, rol, avatar opcional); datos de contacto o laborales que introduzca; contenido y metadatos de documentos; datos técnicos de conexión (por ejemplo IP y agente de usuario) cuando resulten necesarios para seguridad y diagnóstico.
            </p>
            <p className={legalP}>
              <strong className="text-[#111318] dark:text-white">Datos sensibles (artículo 8 LFPDPPP):</strong> cuando la ley exija consentimiento expreso y por escrito para datos sensibles, el responsable deberá implementarlo en su flujo operativo. Si su despliegio no los recaba de forma autónoma, no se aplicará el régimen reforzado salvo que usted los incorpore en documentos; en ese caso el tratamiento será el estrictamente necesario para el Servicio y las obligaciones legales aplicables.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Fundamento y consentimiento</h2>
            <p className={legalP}>
              El tratamiento se funda en el consentimiento cuando la ley lo exija, en la relación contractual para finalidades primarias y en obligaciones legales cuando corresponda. Las casillas en registro e inicio de sesión documentan, a nivel de interfaz, la lectura del aviso y de los términos; el servidor registra marcas de tiempo descritas más abajo. El consentimiento puede revocarse en cualquier momento sin efectos retroactivos; los mecanismos para revocación se indican en la sección homónima.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Transferencias (artículos 35 y 36)</h2>
            <p className={`mb-4 ${legalP}`}>
              Cuando el responsable transfiera datos a terceros distintos del encargado, deberá comunicar a los receptores el aviso y las finalidades a que el titular sujetó el tratamiento; el aviso integral deberá indicar si el titular acepta o no la transferencia, y el receptor asumirá las obligaciones que correspondan al responsable que transfirió, en los términos del artículo 35.
            </p>
            <p className={legalP}>
              Las transferencias nacionales o internacionales pueden realizarse sin consentimiento del titular solo en los supuestos del artículo 36 (ley o tratado, salud en los casos previstos, mismo grupo corporativo con políticas alineadas, contrato en interés del titular, interés público o administración de justicia, proceso judicial, o relación jurídica entre responsable y titular). Liste en la versión final de este aviso a proveedores de nube, subprocesadores y encargados con su ubicación y finalidad. Si no hay transferencias, declárelo expresamente salvo requerimientos de autoridad competente.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Limitación del uso o divulgación</h2>
            <p className={legalP}>
              Puede solicitar la limitación del uso o divulgación de sus datos personales conforme a la LFPDPPP, en coordinación con el ejercicio de derechos ARCO, dirigiendo su petición al correo de privacidad indicado en la identidad del responsable, con la información prevista en el artículo 28 de la ley.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Trámite interno de solicitudes (artículo 29)</h2>
            <p className={legalP}>
              El responsable designará persona o área que dé trámite a las solicitudes de titulares para el ejercicio de derechos; las peticiones al correo de privacidad serán canalizadas a dicho área.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Seguridad (artículos 18 a 20)</h2>
            <p className={`mb-4 ${legalP}`}>
              Medidas administrativas, técnicas y físicas proporcionales al riesgo: controles de acceso, cifrado en tránsito cuando aplique, opción de segundo factor si está habilitada, respaldos y revisiones periódicas. Las vulneraciones que afecten de forma significativa derechos patrimoniales o morales deberán informarse al titular de forma inmediata, en los términos del artículo 19.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Cifrado y permisos</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Protección de expedientes y acceso por niveles según configuración.</p>
              </div>
              <div className="rounded-lg bg-background-light dark:bg-gray-800 p-6">
                <h3 className="font-bold text-[#111318] dark:text-white mb-2">Bitácoras</h3>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#d1d5db]">Registros de actividad relevantes para auditoría y prevención de accesos indebidos.</p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Conservación</h2>
            <p className={legalP}>
              Los datos se conservan el tiempo necesario para las finalidades y obligaciones legales. Tras la baja de la cuenta, aplicarán los plazos de eliminación o anonimización que defina el responsable y comunique en este aviso.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Bitácora técnica (marcas de tiempo)</h2>
            <p className={`mb-4 ${legalP}`}>
              Para transparencia y trazabilidad, el sistema puede registrar en el perfil de usuario:
            </p>
            <ul className="list-disc space-y-2 pl-6 marker:text-primary text-[1.05rem] leading-relaxed text-[#374151] dark:text-[#d1d5db]">
              <li>
                <strong className="text-[#111318] dark:text-white">Alta:</strong> fecha y hora de aceptación inicial de términos y de privacidad al crear la cuenta.
              </li>
              <li>
                <strong className="text-[#111318] dark:text-white">Cada inicio de sesión:</strong> fecha y hora en que se vuelven a confirmar en pantalla ambos documentos. Estas marcas no sustituyen el consentimiento de alta; acreditan acceso a la versión publicada en la plataforma en ese acceso.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Derechos ARCO (artículos 21 a 25, 28, 30 y 31)</h2>
            <p className={`mb-4 ${legalP}`}>
              Puede acceder, rectificar, cancelar u oponerse al tratamiento. La solicitud deberá contener lo previsto en el artículo 28 (nombre y medio de notificación, documentos que acrediten identidad o representación, descripción de datos salvo en acceso, derecho que ejerce, elementos que faciliten la localización). En rectificación, indique las modificaciones y aporte documentación que las sustente (artículo 30).
            </p>
            <p className={legalP}>
              El responsable comunicará la determinación en un plazo máximo de{" "}
              <strong className="text-[#111318] dark:text-white">veinte días</strong> contados desde el recibo de la solicitud; si procede, hará efectivo el derecho dentro de los{" "}
              <strong className="text-[#111318] dark:text-white">quince días</strong> siguientes a la comunicación de la respuesta. En acceso, la entrega podrá condicionarse a la acreditación de identidad conforme a ley. Los plazos podrán ampliarse una sola vez por un periodo igual si las circunstancias del caso lo justifican (artículo 31).
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Revocación del consentimiento (artículo 7)</h2>
            <p className={legalP}>
              Puede revocar el consentimiento en cualquier momento sin efectos retroactivos, mediante solicitud al mismo correo de privacidad, describiendo claramente el alcance de la revocación. Si el tratamiento revocado es indispensable para continuar el Servicio, la revocación podrá implicar la terminación de la relación contractual en los términos de los{" "}
              <Link to={termsHref} className="text-primary font-semibold underline underline-offset-2">
                Términos y condiciones
              </Link>
              .
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Procedimiento de protección de derechos (artículos 40 y 41)</h2>
            <p className={legalP}>
              Si no está conforme con la respuesta del responsable, no recibe respuesta dentro del plazo legal, o la entrega de datos es incompleta o en formato incomprensible, podrá presentar solicitud de protección de datos ante la Secretaría Anticorrupción y Buen Gobierno dentro de los{" "}
              <strong className="text-[#111318] dark:text-white">quince días</strong> siguientes a la fecha en que se le comunique la respuesta del responsable, o a partir del vencimiento del plazo de respuesta si no hubo contestación, acompañando la prueba de la fecha en que presentó su solicitud ARCO. El reglamento y los formatos o sistema electrónico que la Secretaría disponga regularán forma y plazos del procedimiento.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Cambios al aviso (artículo 15 fracción VI)</h2>
            <p className={legalP}>
              El responsable puede modificar este aviso. La versión vigente permanecerá accesible en SIDOC; se actualizará la fecha de última modificación en esta pantalla y, cuando corresponda, se solicitará nueva manifestación de voluntad conforme a ley.
            </p>
          </section>
          <section>
            <h2 className="mb-6 text-2xl font-bold text-[#111318] dark:text-white">Autoridad de vigilancia</h2>
            <p className={legalP}>
              Conforme a la LFPDPPP reformada, la vigilancia, verificación y procedimientos administrativos en la materia corresponden a la{" "}
              <strong className="text-[#111318] dark:text-white">Secretaría Anticorrupción y Buen Gobierno</strong> (en la ley denominada «la Secretaría»). Para trámites y publicaciones oficiales vigentes puede consultar, entre otros, el portal de transparencia de la propia Secretaría en{" "}
              <a
                href="https://portal-transparencia.buengobierno.gob.mx/proteccion-de-datos-personales/informacion-relevante-en-materia-de-proteccion-de-datos-personales/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold underline underline-offset-2 break-all"
              >
                portal-transparencia.buengobierno.gob.mx
              </a>{" "}
              y el sitio institucional en{" "}
              <a href="https://www.gob.mx/buengobierno" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline underline-offset-2">
                gob.mx/buengobierno
              </a>
              .
            </p>
          </section>
        </article>
        <div className="mt-16 sm:mt-20 border-t border-slate-200 dark:border-slate-700 pt-8">
          <Link
            to={termsHref}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined">article</span>
            Ver Términos y condiciones
          </Link>
        </div>
      </div>
    </div>
  );
};
