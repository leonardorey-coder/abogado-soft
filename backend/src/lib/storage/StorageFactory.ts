// =============================================================================
// StorageFactory.ts — Singleton factory del proveedor de almacenamiento
//
// Selecciona la implementación según STORAGE_PROVIDER:
//   · "r2"    — Cloudflare R2 (producción)
//   · "local" — Disco local (desarrollo / testing)
//
// Usa un singleton para no crear nuevas instancias (y nuevos clientes S3)
// en cada request.
// =============================================================================

import type { IStorageProvider } from './IStorageProvider.js';

export type StorageProviderType = 'r2' | 'local';

let _instance: IStorageProvider | null = null;

/**
 * Retorna el singleton del proveedor de almacenamiento.
 * La instancia se crea la primera vez que se llama.
 */
export function getStorageProvider(): IStorageProvider {
  if (_instance) return _instance;

  const type = (process.env.STORAGE_PROVIDER as StorageProviderType) ?? 'r2';

  switch (type) {
    case 'r2': {
      const { R2StorageProvider } = require('./R2StorageProvider.js');
      _instance = new R2StorageProvider();
      break;
    }
    case 'local': {
      const { LocalStorageProvider } = require('./LocalStorageProvider.js');
      _instance = new LocalStorageProvider();
      break;
    }
    default:
      throw new Error(
        `[StorageFactory] Proveedor de almacenamiento no soportado: "${type}". ` +
        `Valores válidos: "r2", "local".`
      );
  }

  console.log(`[Storage] Proveedor inicializado: ${type}`);
  return _instance!;
}

/**
 * Reinicia el singleton (útil en tests o para forzar recarga de config).
 */
export function resetStorageProvider(): void {
  _instance = null;
}
