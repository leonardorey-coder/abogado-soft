// ============================================================================
// Auth Client — Frontend
// Autenticación propia con email/contraseña y JWT local.
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'asistente';
  avatarUrl?: string | null;
  officeName?: string | null;
  isActive: boolean;
  needsProfileSetup?: boolean;
  groupMemberships?: Array<{
    id: string;
    role: string;
    group: { id: string; name: string; description?: string | null };
  }>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

export interface AuthResult {
  user: AppUser;
  session: AuthSession;
}

export interface AuthError {
  error: string;
}

export type AuthResponse = AuthResult | AuthError;

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  officeName?: string | null;
}

// ─── Almacenamiento de sesión (memoria + localStorage) ───────────────────────

let _session: AuthSession | null = null;

const STORAGE_KEY = 'sidoc_session';

function saveSession(session: AuthSession): void {
  _session = session;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* privado/incógnito */ }
}

function clearSession(): void {
  _session = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function loadStoredSession(): AuthSession | null {
  if (_session) return _session;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    _session = session;
    return session;
  } catch {
    return null;
  }
}

// ─── API Helper ──────────────────────────────────────────────────────────────

async function apiRequest(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
}

// ─── Access Token con auto-refresh ───────────────────────────────────────────

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refrescar si faltan menos de 5 min

let _refreshPromise: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  const session = loadStoredSession();
  if (!session) return null;

  const isExpiringSoon = session.expiresAt - Date.now() < REFRESH_THRESHOLD_MS;

  if (!isExpiringSoon) return session.accessToken;

  // Serializar llamadas de refresh concurrentes
  if (!_refreshPromise) {
    _refreshPromise = refreshSession().finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

export async function refreshSession(): Promise<string | null> {
  const session = loadStoredSession();
  if (!session?.refreshToken) return null;

  try {
    const res = await apiRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = await res.json() as { accessToken: string; refreshToken: string };
    const newSession: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000, // ~55 min (access token dura 1h)
    };
    saveSession(newSession);
    return newSession.accessToken;
  } catch {
    return null;
  }
}

// ─── Registro ────────────────────────────────────────────────────────────────

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        name: payload.fullName,
        ...(payload.officeName ? { officeName: payload.officeName } : {}),
        role: 'admin',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error ?? 'Error al crear la cuenta.' };
    }

    const session: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    saveSession(session);

    return { user: data.user as AppUser, session };
  } catch {
    return { error: 'Error de conexión. Intente de nuevo.' };
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error ?? 'Correo o contraseña incorrectos.' };
    }

    const session: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    saveSession(session);

    return { user: data.user as AppUser, session };
  } catch {
    return { error: 'Error de conexión. Intente de nuevo.' };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const session = loadStoredSession();
  if (session) {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch { /* silenciar: si falla, igual limpiamos local */ }
  }
  clearSession();
}

export async function notifyConnectionStart(reason = 'app_open'): Promise<void> {
  const session = loadStoredSession();
  if (!session) return;
  try {
    await apiRequest('/auth/connection/start', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({ refreshToken: session.refreshToken, reason }),
    });
  } catch {}
}

export async function notifyConnectionEnd(reason = 'disconnect'): Promise<void> {
  const session = loadStoredSession();
  if (!session) return;
  try {
    await fetch(`${API_URL}/auth/connection/end`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: session.refreshToken, reason }),
    });
  } catch {}
}

// ─── Obtener perfil actual ────────────────────────────────────────────────────

export async function fetchCurrentUser(accessToken: string): Promise<AppUser | null> {
  try {
    const res = await apiRequest('/auth/me', { token: accessToken });
    if (!res.ok) return null;
    const data = await res.json() as AppUser & { needsProfileSetup?: boolean };
    if (typeof data.needsProfileSetup === 'boolean') return data;
    const needsProfileSetup = !data.groupMemberships || data.groupMemberships.length === 0;
    return { ...data, needsProfileSetup };
  } catch {
    return null;
  }
}

// ─── Sesión inicial (equivalente al antiguo getSession) ──────────────────────

export async function getSession(): Promise<{ session: AuthSession | null; user: AppUser | null }> {
  try {
    const token = await getAccessToken();
    if (!token) return { session: null, user: null };

    const session = loadStoredSession();
    const user = await fetchCurrentUser(token);
    return { session, user };
  } catch {
    return { session: null, user: null };
  }
}
