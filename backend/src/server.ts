// Bun carga .env automáticamente — no necesita dotenv
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

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
import { setupCronJobs } from './cronJobs.js';
// ─── Rutas ───────────────────────────────────────────────────────────────────

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

// ─── Error handler (siempre al final) ────────────────────────────────────────
app.use(errorHandler);

// Inicializar tareas programadas (Cron)
setupCronJobs();

// ─── Iniciar servidor ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 AbogadoSoft API corriendo en http://localhost:${PORT}`);
  console.log(`⚡ Runtime: Bun ${process.versions.bun || 'unknown'}`);
  console.log(`📦 Entorno: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
