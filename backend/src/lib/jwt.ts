import jwt from 'jsonwebtoken';

const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '7d';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET ?? '';
  if (!secret) {
    console.warn('JWT_SECRET no configurado — la autenticación no funcionará');
  }
  return secret;
}

function getRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? '';
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getAccessSecret(), { expiresIn: ACCESS_EXPIRES });
}

export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getAccessSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getRefreshSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export { REFRESH_EXPIRES_MS };
