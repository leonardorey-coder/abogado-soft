import prisma from './prisma.js';

/** Evita "Vio documento" duplicado si el GET del recurso se dispara dos veces seguidas
 * (p. ej. React Strict Mode en desarrollo o refetch inmediato). */
const VIEW_LOG_DEDUPE_WINDOW_MS = 10_000;
const recentViewLogByKey = new Map<string, number>();

export async function hasRecentDocumentViewedLog(params: {
  userId: string;
  entityType: string;
  entityId: string;
}): Promise<boolean> {
  const key = `${params.userId}:${params.entityType}:${params.entityId}`;
  const now = Date.now();
  const inMemoryTs = recentViewLogByKey.get(key);
  if (inMemoryTs && now - inMemoryTs <= VIEW_LOG_DEDUPE_WINDOW_MS) {
    return true;
  }
  // Reserva temporal para evitar carrera entre requests simultáneas.
  recentViewLogByKey.set(key, now);

  const since = new Date(Date.now() - VIEW_LOG_DEDUPE_WINDOW_MS);
  const row = await prisma.activityLog.findFirst({
    where: {
      userId: params.userId,
      activity: 'DOCUMENT_VIEWED',
      entityType: params.entityType,
      entityId: params.entityId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  const hasRecent = row !== null;
  if (!hasRecent) {
    recentViewLogByKey.set(key, now);
  }
  return hasRecent;
}
