// ============================================================================
// Supabase Auth Client — Frontend
// Usa @supabase/supabase-js para autenticación (email + Google OAuth).
// Después de cada auth, sincroniza el usuario con nuestro backend vía Prisma.
// ============================================================================

import { createClient, type User, type Session, type AuthChangeEvent } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en las variables de entorno');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'asistente';
  avatarUrl?: string | null;
  officeName?: string | null;
  isActive: boolean;
  needsProfileSetup?: boolean;
}

export interface AuthResult {
  user: AppUser;
  session: Session;
}

export interface AuthError {
  error: string;
}

export type AuthResponse = AuthResult | AuthError;

// ─── API Helper ─────────────────────────────────────────────────────────────

async function apiRequest(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
}

// ─── Registro con email/password ──────────────────────────────────────────

export interface RegisterPayload {
  fullName: string;
  email: string;
  officeName?: string | null;
  password: string;
}

export async function registerWithSupabase(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    // 1. Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          ...(payload.officeName != null && payload.officeName !== '' && { office_name: payload.officeName }),
        },
      },
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }

    if (!data.user || !data.session) {
      return { error: 'Verifique su correo electrónico para activar su cuenta.' };
    }

    // 2. Crear perfil en nuestro backend (Prisma)
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      token: data.session.access_token,
      body: JSON.stringify({
        id: data.user.id,
        email: data.user.email!,
        name: payload.fullName,
        ...(payload.officeName != null && payload.officeName !== '' && { officeName: payload.officeName }),
        role: 'admin',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error creando perfil' }));
      return { error: err.error ?? 'Error creando perfil en el servidor' };
    }

    const appUser = await res.json();

    return {
      user: appUser,
      session: data.session,
    };
  } catch (err) {
    console.error('Error en registro:', err);
    return { error: 'Error de conexión. Intente de nuevo.' };
  }
}

// ─── Login con email/password ─────────────────────────────────────────────

export async function signInWithSupabase(
  email: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }

    if (!data.session) {
      return { error: 'No se pudo iniciar sesión.' };
    }

    // Sincronizar usuario con backend
    const appUser = await syncUserWithBackend(data.user, data.session.access_token);
    if (!appUser) {
      return { error: 'Error sincronizando con el servidor.' };
    }

    return { user: appUser, session: data.session };
  } catch (err) {
    console.error('Error en login:', err);
    return { error: 'Error de conexión. Intente de nuevo.' };
  }
}

// ─── Login con Google OAuth ───────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }

    // El redirect se maneja automáticamente por Supabase
    return {};
  } catch (err) {
    console.error('Error en Google login:', err);
    return { error: 'Error al conectar con Google.' };
  }
}

// ─── Sincronizar usuario con backend ────────────────────────────────────

async function syncUserWithBackend(user: User, accessToken: string): Promise<AppUser | null> {
  try {
    const res = await apiRequest('/auth/sync', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email!.split('@')[0],
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }),
    });

    if (!res.ok) {
      console.error('Error syncing user:', await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Error syncing user with backend:', err);
    return null;
  }
}

/** Exportada para uso desde AuthContext después de OAuth redirect */
export async function syncUserAfterOAuth(user: User, accessToken: string): Promise<AppUser | null> {
  return syncUserWithBackend(user, accessToken);
}

// ─── Sesión y estado ──────────────────────────────────────────────────────

export async function getSession(): Promise<{ session: Session | null; user: AppUser | null }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return { session: null, user: null };
    }

    // Obtener perfil del backend
    const appUser = await fetchCurrentUser(session.access_token);
    return { session, user: appUser };
  } catch {
    return { session: null, user: null };
  }
}

export async function fetchCurrentUser(accessToken: string): Promise<AppUser | null> {
  try {
    const res = await apiRequest('/auth/me', { token: accessToken });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        token: session.access_token,
      }).catch(() => {});
    }
  } finally {
    await supabase.auth.signOut();
  }
}

// ─── Listener de cambios de auth ────────────────────────────────────────

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}

// ─── Traducir errores de Supabase Auth ──────────────────────────────────

function translateAuthError(message: string): string {
  const translations: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Debe confirmar su correo electrónico primero.',
    'User already registered': 'Ya existe una cuenta con este correo.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    'Signup requires a valid password': 'Ingrese una contraseña válida.',
    'Email rate limit exceeded': 'Demasiados intentos. Espere un momento.',
    'For security purposes, you can only request this after': 'Por seguridad, espere antes de intentar de nuevo.',
  };

  for (const [key, value] of Object.entries(translations)) {
    if (message.includes(key)) return value;
  }

  return message;
}
