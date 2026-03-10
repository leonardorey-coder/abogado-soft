import cron from 'node-cron';
import { generateSystemBackup } from './lib/backupService.js';

export function setupCronJobs() {
    // Schedule a daily backup at midnight
    // Formato de cron: 'minuto hora dia_mes mes dia_semana'
    // '0 0 * * *' = A las 00:00 todos los días
    cron.schedule('0 0 * * *', async () => {
        console.log('[Cron] Ejecutando respaldo automático diario (00:00)...');
        try {
            await generateSystemBackup(null, `diario_${new Date().toISOString().split('T')[0]}_auto`, 'diario');
            console.log('[Cron] Respaldo diario automático completado exitosamente.');
        } catch (error) {
            console.error('[Cron] Error en el respaldo diario automático:', error);
        }
    });

    console.log('[Cron] Temporizadores de Respaldos Automáticos inicializados.');
}
