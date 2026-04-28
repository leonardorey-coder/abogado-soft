import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { hasCompletedWorkspaceSetup } from "../lib/auth";
import { AppBrand } from "./AppBrand";

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
                <div className="flex flex-col items-center gap-5">
                    <div className="animate-pulse opacity-90">
                        <AppBrand size="lg" wordmark="always" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">Cargando…</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const needsWorkspaceSetup = user.needsProfileSetup || !hasCompletedWorkspaceSetup(user.id);

    if (needsWorkspaceSetup && location.pathname !== "/completar-perfil") {
        return <Navigate to="/completar-perfil" replace />;
    }

    return <Outlet />;
};
