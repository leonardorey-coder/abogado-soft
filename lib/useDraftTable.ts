// ============================================================================
// useDraftTable — Hook para borradores de tablas (TableData JSON)
//
// Soporta versioning — cada versionId tiene su propio borrador independiente.
// Usado en: ExcelEditor (convenio-table), DocumentXlsxEditor.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { draftStorage, DraftMeta, DraftRecord } from './draftStorage';
import type { TableData } from './api';

export interface UseDraftTableOptions {
  /** userId del usuario autenticado — null desactiva el hook */
  userId: string | null;
  /** ID del convenio o documento */
  resourceId: string | null;
  /** 'current' o UUID de una versión histórica */
  versionId: string;
  /** Número de versión legible para UI */
  versionNum: number | null;
  /** Nombre legible del recurso */
  label: string;
  /** false desactiva escritura de borradores (modo lectura) */
  enabled: boolean;
}

export interface UseDraftTableReturn {
  /** true si existe un borrador válido en IDB para esta versión */
  hasDraft: boolean;
  /** Metadatos del borrador */
  draftMeta: DraftMeta | null;
  /**
   * Guarda la tabla con debounce de 800ms.
   * Llamar en cada cambio de celda / cambio de tableData.
   */
  saveDraft: (data: TableData) => void;
  /** Elimina el borrador — llamar tras save exitoso al servidor */
  clearDraft: () => Promise<void>;
  /** Lee y retorna el TableData del borrador o null */
  restoreTable: () => Promise<TableData | null>;
}

const DEBOUNCE_MS = 800;

export function useDraftTable({
  userId,
  resourceId,
  versionId,
  versionNum,
  label,
  enabled,
}: UseDraftTableOptions): UseDraftTableReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = userId && resourceId
    ? draftStorage.keyFor('convenio-table', userId, resourceId, versionId)
    : null;

  // ─── Verificar borrador al montar o cambiar versión ─────────────────────
  useEffect(() => {
    if (!key) {
      setHasDraft(false);
      setDraftMeta(null);
      return;
    }
    let cancelled = false;
    draftStorage.get(key).then((record: DraftRecord | null) => {
      if (cancelled) return;
      if (record && record.kind === 'json') {
        setHasDraft(true);
        setDraftMeta(record.meta);
      } else {
        setHasDraft(false);
        setDraftMeta(null);
      }
    });
    return () => { cancelled = true; };
  }, [key]);

  // ─── Cleanup del debounce al desmontar ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Guardar borrador (debounced) ────────────────────────────────────────
  const saveDraft = useCallback((data: TableData) => {
    if (!enabled || !key || !resourceId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const meta: DraftMeta = {
          savedAt: new Date().toISOString(),
          resourceId,
          versionId,
          versionNum,
          label,
          type: 'convenio-table',
        };
        await draftStorage.set(key, data as unknown as object, meta);
      } catch (err) {
        console.warn('[useDraftTable] Error en guardado de borrador:', err);
      }
    }, DEBOUNCE_MS);
  }, [enabled, key, resourceId, versionId, versionNum, label]);

  // ─── Eliminar borrador ───────────────────────────────────────────────────
  const clearDraft = useCallback(async () => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await draftStorage.delete(key);
    setHasDraft(false);
    setDraftMeta(null);
  }, [key]);

  // ─── Restaurar tabla ─────────────────────────────────────────────────────
  const restoreTable = useCallback(async (): Promise<TableData | null> => {
    if (!key) return null;
    const record = await draftStorage.get(key);
    if (record && record.kind === 'json' && !(record.payload instanceof Blob)) {
      const data = record.payload as unknown as TableData;
      if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
        return data;
      }
    }
    return null;
  }, [key]);

  return { hasDraft, draftMeta, saveDraft, clearDraft, restoreTable };
}
