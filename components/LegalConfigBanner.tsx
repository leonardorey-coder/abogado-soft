import React from "react";

interface LegalConfigBannerProps {
  docLabel: string;
}

export const LegalConfigBanner: React.FC<LegalConfigBannerProps> = ({ docLabel }) => {
  return (
    <div className="mb-10">
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/60 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>
          Este {docLabel} se elaboró con base en la{" "}
          <strong className="text-slate-900 dark:text-white">
            Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          </strong>{" "}
          (publicada en el <abbr title="Diario Oficial de la Federación">DOF</abbr> el 20 de marzo de 2025, con reformas
          posteriores) y en prácticas habituales para plataformas SaaS.{" "}
          <strong className="text-slate-900 dark:text-white">
            No sustituye el dictamen de un abogado
          </strong>{" "}
          en México: revíselo con su despacho antes de exponerlo a titulares en producción.
        </p>
      </div>
    </div>
  );
};
