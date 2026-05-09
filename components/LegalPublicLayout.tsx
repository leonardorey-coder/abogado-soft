import React from "react";
import { Outlet, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppBrand } from "./AppBrand";

export const LegalPublicLayout: React.FC = () => {
  const [params] = useSearchParams();
  const from = params.get("from");
  const { user, loading } = useAuth();

  let backHref = "/login";
  let backLabel = "Volver al inicio de sesión";
  if (from === "registro") {
    backHref = "/registro";
    backLabel = "Volver al registro";
  } else if (from === "login") {
    backHref = "/login";
    backLabel = "Volver al inicio de sesión";
  } else if (!loading && user) {
    backHref = "/";
    backLabel = "Volver al inicio";
  }

  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-display">
      <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
        <div className="mx-auto max-w-[800px] px-4 py-3 flex items-center justify-between gap-4">
          <Link
            to={backHref}
            className="flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">Volver</span>
          </Link>
          <Link to="/" className="opacity-90 hover:opacity-100 transition-opacity shrink min-w-0">
            <AppBrand size="sm" wordmark="always" className="max-w-[200px] sm:max-w-none" />
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
};
