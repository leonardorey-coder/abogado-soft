import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppBrand } from "./AppBrand";

/**
 * Ruta exclusiva para usuarios NO autenticados.
 * Si ya hay sesión → redirige al dashboard.
 */
export const GuestRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="flex flex-col items-center gap-5">
                    <div className="animate-pulse opacity-90">
                        <AppBrand size="lg" wordmark="always" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">Cargando…</p>
                </div>
            </div>
        );
    }

    if (user && user.needsProfileSetup === false) {
        return <Navigate to="/" replace />;
    }

    if (user && user.needsProfileSetup !== false) {
        return <Navigate to="/completar-perfil" replace />;
    }

    return <Outlet />;
};
