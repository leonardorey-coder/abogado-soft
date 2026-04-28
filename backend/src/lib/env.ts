import fs from 'fs';
import path from 'path';

function parseDotEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function mergeEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const parsed = parseDotEnv(fs.readFileSync(filePath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    const cur = process.env[k];
    if ((cur === undefined || cur === '') && v !== undefined) process.env[k] = v;
  }
}

export function loadProjectEnvIfNeeded() {
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '..', '.env'),
      path.resolve(process.cwd(), '..', '.env.local'),
    ];
    for (const filePath of candidates) {
      mergeEnvFile(filePath);
    }
  } catch {
    // Si falla, seguimos con el entorno actual.
  }
}

export function getDatabaseUrls() {
  loadProjectEnvIfNeeded();

  const directUrl = process.env.DIRECT_URL?.trim() || '';
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const runtimeUrl = databaseUrl || directUrl;
  const migrationUrl = directUrl || databaseUrl;

  return {
    databaseUrl,
    directUrl,
    runtimeUrl,
    migrationUrl,
  };
}
