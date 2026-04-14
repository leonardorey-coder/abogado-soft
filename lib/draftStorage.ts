// ============================================================================
// draftStorage — Wrapper de IndexedDB para borradores temporales
//
// DB:    "abogado-drafts" (versión 1)
// Store: "drafts"  keyPath: "key"
//
// Claves:
//   doc:<userId>:<resourceId>:<versionId>
//   convenio-form:<userId>:<resourceId>:<versionId>
//   convenio-table:<userId>:<resourceId>:<versionId>
//
// - TTL de 7 días con limpieza lazy al leer
// - Silencia errores internos — nunca debe crashear la UI
// ============================================================================

const DB_NAME = 'abogado-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type DraftType = 'doc' | 'convenio-form' | 'convenio-table';
export type DraftKind = 'blob' | 'json';

export interface DraftMeta {
  savedAt: string;        // ISO string
  resourceId: string;     // documentId | convenioId | 'new'
  versionId: string;      // 'current' | '<uuid de versión>'
  versionNum: number | null;
  label: string;          // nombre legible del recurso
  type: DraftType;
}

export interface DraftRecord {
  key: string;
  payload: Blob | object;
  kind: DraftKind;
  meta: DraftMeta;
}

// ─── Singleton DB ────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
  return dbPromise;
}

// ─── Helpers IDB ─────────────────────────────────────────────────────────────

function idbPut(db: IDBDatabase, record: DraftRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<DraftRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = (e) => resolve((e.target as IDBRequest).result as DraftRecord | undefined);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<DraftRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => resolve((e.target as IDBRequest).result as DraftRecord[]);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbDeleteBatch(db: IDBDatabase, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let pending = keys.length;
    if (pending === 0) { resolve(); return; }
    for (const key of keys) {
      const req = store.delete(key);
      req.onsuccess = () => { if (--pending === 0) resolve(); };
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    }
  });
}

// ─── Comprobación TTL ────────────────────────────────────────────────────────

function isExpired(meta: DraftMeta): boolean {
  return Date.now() - new Date(meta.savedAt).getTime() > TTL_MS;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export const draftStorage = {
  /**
   * Construye la clave canónica para un borrador.
   */
  keyFor(type: DraftType, userId: string, resourceId: string, versionId: string): string {
    return `${type}:${userId}:${resourceId}:${versionId}`;
  },

  /**
   * Guarda o sobreescribe un borrador.
   * Silencia errores internamente — no lanza.
   */
  async set(key: string, payload: Blob | object, meta: DraftMeta): Promise<void> {
    try {
      const db = await openDB();
      const kind: DraftKind = payload instanceof Blob ? 'blob' : 'json';
      const record: DraftRecord = { key, payload, kind, meta };
      await idbPut(db, record);
    } catch (err) {
      console.warn('[draftStorage] Error al guardar borrador:', err);
    }
  },

  /**
   * Lee un borrador por clave.
   * Retorna null si no existe o si expiró (y lo elimina en ese caso).
   * Silencia errores internamente.
   */
  async get(key: string): Promise<DraftRecord | null> {
    try {
      const db = await openDB();
      const record = await idbGet(db, key);
      if (!record) return null;
      if (isExpired(record.meta)) {
        await idbDelete(db, key).catch(() => {});
        return null;
      }
      return record;
    } catch (err) {
      console.warn('[draftStorage] Error al leer borrador:', err);
      return null;
    }
  },

  /**
   * Elimina un borrador por clave.
   */
  async delete(key: string): Promise<void> {
    try {
      const db = await openDB();
      await idbDelete(db, key);
    } catch (err) {
      console.warn('[draftStorage] Error al eliminar borrador:', err);
    }
  },

  /**
   * Lista todos los borradores activos de un usuario (respetando TTL).
   * Útil para futura UI de "mis borradores".
   */
  async listByUser(userId: string): Promise<DraftRecord[]> {
    try {
      const db = await openDB();
      const all = await idbGetAll(db);
      const expired: string[] = [];
      const valid: DraftRecord[] = [];
      for (const record of all) {
        const belongsToUser = record.meta.type === 'doc'
          ? record.key.startsWith(`doc:${userId}:`)
          : record.key.startsWith(`${record.meta.type}:${userId}:`);
        if (!belongsToUser) continue;
        if (isExpired(record.meta)) {
          expired.push(record.key);
        } else {
          valid.push(record);
        }
      }
      if (expired.length > 0) {
        await idbDeleteBatch(db, expired).catch(() => {});
      }
      return valid;
    } catch (err) {
      console.warn('[draftStorage] Error al listar borradores:', err);
      return [];
    }
  },

  /**
   * Elimina TODOS los borradores de un usuario.
   * Llamado en logout para limpiar datos sensibles.
   */
  async deleteAll(userId: string): Promise<void> {
    try {
      const db = await openDB();
      const all = await idbGetAll(db);
      const userKeys = all
        .filter(r => r.key.includes(`:${userId}:`))
        .map(r => r.key);
      if (userKeys.length > 0) {
        await idbDeleteBatch(db, userKeys);
      }
    } catch (err) {
      console.warn('[draftStorage] Error al eliminar borradores del usuario:', err);
    }
  },
};
