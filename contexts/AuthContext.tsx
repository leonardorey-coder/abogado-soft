// ============================================================================
// AuthContext — Provee estado de autenticación a toda la aplicación
// Detecta sesión existente al cargar y redirige a login si no hay auth.
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  getSession,
  signOut as supabaseSignOut,
  syncUserAfterOAuth,
  type AppUser,
} from '../lib/supabaseAuth';

interface AuthContextValue {
  /** Usuario autenticado (perfil de nuestro backend) */
  user: AppUser | null;
  /** Sesión de Supabase Auth */
  session: Session | null;
  /** true mientras se verifica la sesión inicial */
  loading: boolean;
  /** Cerrar sesión */
  logout: () => Promise<void>;
  /** Actualizar datos del usuario desde el backend */
  refreshUser: () => Promise<void>;
  /** Establecer usuario tras login/register exitoso */
  setAuth: (user: AppUser, session: Session) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Verificar sesión al montar ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const result = await getSession();
        if (mounted) {
          setSession(result.session);
          setUser(result.user);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkSession();

    // Escuchar cambios de auth (login, logout, token refresh, OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession) {
          // Después de OAuth redirect o login, sincronizar con backend
          const supaUser = newSession.user;
          const { fetchCurrentUser } = await import('../lib/supabaseAuth');

          // Intentar obtener usuario existente del backend
          let appUser = await fetchCurrentUser(newSession.access_token);

          // Si no existe (primer login con Google), crear/sincronizar
          if (!appUser && supaUser) {
            appUser = await syncUserAfterOAuth(supaUser, newSession.access_token);
          }

          if (mounted) setUser(appUser);
        }

        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setSession(null);
          }
        }

        if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabaseSignOut();
    setUser(null);
    setSession(null);
  }, []);

  // ─── Refrescar datos del usuario ────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    if (!session) return;
    const { fetchCurrentUser } = await import('../lib/supabaseAuth');
    const appUser = await fetchCurrentUser(session.access_token);
    if (appUser) setUser(appUser);
  }, [session]);

  // ─── Establecer auth tras login manual ──────────────────────────────────
  const setAuth = useCallback((newUser: AppUser, newSession: Session) => {
    setUser(newUser);
    setSession(newSession);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, refreshUser, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
