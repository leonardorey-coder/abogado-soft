import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Ruta exclusiva para usuarios NO autenticados.
 * Si ya hay sesión → redirige al dashboard.
 */
export const GuestRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-primary text-white p-4 rounded-xl shadow-lg shadow-primary/20 animate-pulse">
                        <span className="material-symbols-outlined text-[48px] block">balance</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">Cargando SIDOC…</p>
                </div>
            </div>
        );
    }

    if (user && !user.needsProfileSetup) {
        return <Navigate to="/" replace />;
    }

    if (user && user.needsProfileSetup) {
        return <Navigate to="/completar-perfil" replace />;
    }

    return <Outlet />;
};
