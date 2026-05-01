import cron from 'node-cron';
import { generateSystemBackup } from './lib/backupService.js';
import prisma from './lib/prisma.js';

export function setupCronJobs() {
    // Schedule a daily backup at midnight
    // Formato de cron: 'minuto hora dia_mes mes dia_semana'
    // '0 0 * * *' = A las 00:00 todos los días
    cron.schedule('0 0 * * *', async () => {
        console.log('[Cron] Ejecutando respaldo automático diario (00:00)...');
        try {
            const firms = await prisma.firm.findMany({
                where: { isActive: true },
                select: { id: true },
            });
            await Promise.allSettled(
                firms.map((firm) =>
                    generateSystemBackup('Respaldo Diario Automático', 'daily_auto', 'system_cron', firm.id),
                ),
            );
            console.log('[Cron] Respaldo diario automático completado exitosamente.');
        } catch (error) {
            console.error('[Cron] Error en el respaldo diario automático:', error);
        }
    });

    console.log('[Cron] Temporizadores de Respaldos Automáticos inicializados.');
}
