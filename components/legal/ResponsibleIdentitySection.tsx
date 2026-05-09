import React from "react";

const box =
  "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-6 shadow-sm";

export const ResponsibleIdentitySection: React.FC = () => {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-[#111318] dark:text-white">
        Identidad y domicilio del responsable
      </h2>
      <div className={box}>
        <p className="text-[#374151] dark:text-slate-300 leading-relaxed">
          Responsable del tratamiento de datos personales y prestador del servicio SIDOC: la persona moral o física
          que opere la instancia productiva de la plataforma. Debe publicar en esta sección, adaptando el código o el
          despliegue de su organización, la razón social o nombre, domicilio y correo electrónico para ejercicio de
          derechos ARCO, privacidad y revocación del consentimiento, conforme al artículo 15 fracción I de la LFPDPPP.
        </p>
      </div>
    </section>
  );
};
