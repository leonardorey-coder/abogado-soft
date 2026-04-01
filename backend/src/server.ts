// Bun carga .env automáticamente desde el cwd. En dev, el backend corre desde /backend,
// así que fusionamos el .env de la raíz del repo para completar (p. ej. GOOGLE_SERVICE_ACCOUNT_PATH).
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { assignmentsRouter } from './routes/assignments.routes.js';
import { conveniosRouter } from './routes/convenios.routes.js';
import { casesRouter } from './routes/cases.routes.js';
import { groupsRouter } from './routes/groups.routes.js';
import { activityRouter } from './routes/activity.routes.js';
import { backupsRouter } from './routes/backups.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { driveRouter } from './routes/drive.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { setupCronJobs } from './cronJobs.js';
import { getSearchService } from './services/search/SearchServiceFactory.js';

// ─── Rutas ───────────────────────────────────────────────────────────────────

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

/** Fusiona `../.env` (raíz del monorepo) con el entorno del proceso solo para claves ausentes o vacías. */
function loadRootEnvIfNeeded() {
  try {
    const rootEnvPath = path.resolve(process.cwd(), '..', '.env');
    if (!fs.existsSync(rootEnvPath)) return;
    const parsed = parseDotEnv(fs.readFileSync(rootEnvPath, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      const cur = process.env[k];
      if ((cur === undefined || cur === '') && v !== undefined) process.env[k] = v;
    }
  } catch {
    // Si falla, seguimos con el entorno actual.
  }
}

loadRootEnvIfNeeded();

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

// ─── Middleware global ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtime: 'bun',
    version: process.versions.bun || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/convenios', conveniosRouter);
app.use('/api/cases', casesRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/drive', driveRouter);
app.use('/api/search', searchRouter);


// ─── Error handler (siempre al final) ────────────────────────────────────────
app.use(errorHandler);

// Inicializar tareas programadas (Cron)
setupCronJobs();

// Inicializar motor de búsqueda (fire-and-forget, no bloquea el arranque)
getSearchService().catch((err) => console.warn('[Search] Error al inicializar:', err));

// ─── Iniciar servidor ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 AbogadoSoft API corriendo en http://localhost:${PORT}`);
  console.log(`⚡ Runtime: Bun ${process.versions.bun || 'unknown'}`);
  console.log(`📦 Entorno: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`🔍 Motor de búsqueda: ${process.env.SEARCH_ENGINE ?? 'prisma'}`);
});


export default app;
