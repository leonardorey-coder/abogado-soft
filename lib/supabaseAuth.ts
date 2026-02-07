export interface RegisterPayload {
  fullName: string;
  email: string;
  officeName: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthResult {
  user: AuthUser;
  error?: never;
}

export interface AuthError {
  user?: never;
  error: string;
}

export type RegisterResult = AuthResult | AuthError;

export async function registerWithSupabase(payload: RegisterPayload): Promise<RegisterResult> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    user: {
      id: "local-placeholder",
      email: payload.email,
      fullName: payload.fullName,
    },
  };
}

export async function signInWithSupabase(email: string, password: string): Promise<AuthResult | AuthError> {
  await new Promise((r) => setTimeout(r, 300));
  return { error: "No conectado a Supabase" };
}

export async function getSession(): Promise<AuthUser | null> {
  return null;
}

export async function signOut(): Promise<void> {}
