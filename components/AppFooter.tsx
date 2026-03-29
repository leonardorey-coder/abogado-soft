import React from "react";
import { Link } from "react-router-dom";

export const AppFooter: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#dbdfe6] dark:border-[#2d3748] py-8 bg-white dark:bg-background-dark">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-[#616f89] dark:text-[#a0aec0] text-sm">
          <span className="material-symbols-outlined text-lg">copyright</span>
          2026 SIDOC - Sistema Integral de Documentos y Convenios
        </div>
        <div className="flex gap-6 text-sm text-[#616f89] dark:text-[#a0aec0]">
          <Link to="/terminos" className="hover:text-primary transition-colors">
            Términos de Servicio
          </Link>
          <Link to="/privacidad" className="hover:text-primary transition-colors">
            Política de Privacidad
          </Link>
          <Link to="/informacion-seguridad" className="hover:text-primary transition-colors">
            Seguridad
          </Link>
        </div>
      </div>
    </footer>
  );
};
