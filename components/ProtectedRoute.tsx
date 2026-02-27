import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Protege rutas que requieren autenticación.
 * - Sin sesión → /login
 * - Necesita completar perfil → /completar-perfil
 * - Todo ok → renderiza <Outlet />
 */
export const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-primary text-white p-4 rounded-xl shadow-lg shadow-primary/20 animate-pulse">
                        <span className="material-symbols-outlined text-[48px] block">balance</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">Cargando Abogadosoft…</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user.needsProfileSetup && location.pathname !== "/completar-perfil") {
        return <Navigate to="/completar-perfil" replace />;
    }

    return <Outlet />;
};
