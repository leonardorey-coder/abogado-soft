import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getSession,
  logout as authLogout,
  fetchCurrentUser,
  getAccessToken,
  loadStoredSession,
  type AppUser,
  type AuthSession,
} from '../lib/auth';
import { draftStorage } from '../lib/draftStorage';

interface AuthContextValue {
  user: AppUser | null;
  session: AuthSession | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuth: (user: AppUser, session: AuthSession) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Programar auto-refresh ────────────────────────────────────────────────
  const scheduleRefresh = useCallback((currentSession: AuthSession) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const msUntilRefresh = currentSession.expiresAt - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) return;

    refreshTimerRef.current = setTimeout(async () => {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        setSession(null);
        return;
      }
      const stored = loadStoredSession();
      if (stored) {
        setSession(stored);
        scheduleRefresh(stored);
      }
    }, msUntilRefresh);
  }, []);

  // ─── Verificar sesión al montar ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const result = await getSession();
        if (!mounted) return;
        setSession(result.session);
        setUser(result.user);
        if (result.session) scheduleRefresh(result.session);
      } catch {
        // sin sesión
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkSession();

    return () => {
      mounted = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (user?.id) {
      await draftStorage.deleteAll(user.id).catch(() => {});
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await authLogout();
    setUser(null);
    setSession(null);
  }, [user]);

  // ─── Refrescar usuario desde backend ──────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const appUser = await fetchCurrentUser(token);
    if (appUser) setUser(appUser);
  }, []);

  // ─── Establecer auth tras login/registro ──────────────────────────────────
  const setAuth = useCallback((newUser: AppUser, newSession: AuthSession) => {
    setUser(newUser);
    setSession(newSession);
    scheduleRefresh(newSession);
  }, [scheduleRefresh]);

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, refreshUser, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
