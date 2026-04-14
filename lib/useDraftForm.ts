// ============================================================================
// useDraftForm — Hook genérico para borradores de formularios JSON
//
// - Guarda el estado del formulario con debounce de 800ms
// - Al montar detecta si existe un borrador
// - clearDraft() elimina el borrador tras submit exitoso
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { draftStorage, DraftMeta, DraftRecord, DraftType } from './draftStorage';

export interface UseDraftFormOptions {
  /** userId del usuario autenticado — null desactiva el hook */
  userId: string | null;
  /** ID del recurso o 'new' para formularios de creación */
  resourceId: string;
  /** Nombre legible para el banner */
  label: string;
  /** Tipo de borrador */
  type: DraftType;
  /** false desactiva el guardado (pero sigue mostrando banners existentes) */
  enabled: boolean;
}

export interface UseDraftFormReturn<T extends object> {
  /** true si existe un borrador válido en IDB */
  hasDraft: boolean;
  /** Metadatos del borrador */
  draftMeta: DraftMeta | null;
  /**
   * Guarda el estado del formulario con debounce de 800ms.
   * Llamar en cada handleChange.
   */
  saveDraft: (data: T) => void;
  /** Elimina el borrador — llamar tras submit exitoso */
  clearDraft: () => Promise<void>;
  /** Lee y retorna los datos del borrador o null */
  restoreForm: () => Promise<T | null>;
}

const DEBOUNCE_MS = 800;

export function useDraftForm<T extends object>({
  userId,
  resourceId,
  label,
  type,
  enabled,
}: UseDraftFormOptions): UseDraftFormReturn<T> {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clave canónica — formularios siempre en versionId='current'
  const key = userId
    ? draftStorage.keyFor(type, userId, resourceId, 'current')
    : null;

  // ─── Verificar borrador al montar o cuando cambia el resourceId ─────────
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
  const saveDraft = useCallback((data: T) => {
    if (!enabled || !key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const meta: DraftMeta = {
          savedAt: new Date().toISOString(),
          resourceId,
          versionId: 'current',
          versionNum: null,
          label,
          type,
        };
        await draftStorage.set(key, data as object, meta);
      } catch (err) {
        console.warn('[useDraftForm] Error en guardado de borrador:', err);
      }
    }, DEBOUNCE_MS);
  }, [enabled, key, resourceId, label, type]);

  // ─── Eliminar borrador ───────────────────────────────────────────────────
  const clearDraft = useCallback(async () => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await draftStorage.delete(key);
    setHasDraft(false);
    setDraftMeta(null);
  }, [key]);

  // ─── Restaurar datos del formulario ─────────────────────────────────────
  const restoreForm = useCallback(async (): Promise<T | null> => {
    if (!key) return null;
    const record = await draftStorage.get(key);
    if (record && record.kind === 'json' && typeof record.payload === 'object' && !(record.payload instanceof Blob)) {
      return record.payload as T;
    }
    return null;
  }, [key]);

  return { hasDraft, draftMeta, saveDraft, clearDraft, restoreForm };
}
