// ============================================================================
// useDraftDoc — Hook para borradores de documentos DOCX (Blob en IndexedDB)
//
// - Guarda el Blob exportado por SuperDoc con debounce de 3 segundos
// - Al montar (o cambiar versionId) detecta si ya existe un borrador
// - clearDraft() elimina el borrador tras un save exitoso al servidor
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { draftStorage, DraftMeta, DraftRecord } from './draftStorage';

export interface UseDraftDocOptions {
  /** userId del usuario autenticado — null desactiva el hook */
  userId: string | null;
  /** ID del documento — null desactiva el hook */
  documentId: string | null;
  /** 'current' o UUID de versión histórica */
  versionId: string;
  /** Número de versión legible (ej. 2) para mostrar en UI */
  versionNum: number | null;
  /** Nombre legible del documento para el banner */
  label: string;
  /** false mientras el editor no es editable (modo lectura) */
  enabled: boolean;
  /** Callback que exporta el Blob del editor */
  getBlob: () => Promise<Blob | null>;
  /** Callback cuando un borrador queda persistido correctamente */
  onPersisted?: () => void;
}

export interface UseDraftDocReturn {
  /** true si hay un borrador válido en IDB para esta versión */
  hasDraft: boolean;
  /** Metadatos del borrador (fecha, nombre, versión) */
  draftMeta: DraftMeta | null;
  /** Mostrar banner de restauración (hay IDB y el usuario no pulsó Restaurar en esta sesión) */
  showDraftBanner: boolean;
  /** Tras Restaurar con éxito: oculta el banner sin borrar IDB hasta guardar en servidor */
  dismissDraftBanner: () => void;
  /**
   * Programa un guardado de borrador con debounce de 3 segundos.
   * Llamar en cada onUpdate del editor.
   */
  scheduleDraftSave: () => void;
  /** Guarda el borrador ya mismo (p. ej. al ocultar pestaña o desmontar) */
  flushDraftSave: () => Promise<void>;
  /** Guarda un Blob ya exportado por el editor para esta versión */
  saveProvidedBlob: (blob: Blob) => Promise<void>;
  /** Elimina el borrador — llamar tras save exitoso al servidor */
  clearDraft: () => Promise<void>;
  /**
   * Restaura el borrador desde IDB.
   * Retorna el Blob o null si no existe/expiró.
   */
  restoreBlob: () => Promise<Blob | null>;
}

const DEBOUNCE_MS = 3_000;

export function useDraftDoc({
  userId,
  documentId,
  versionId,
  versionNum,
  label,
  enabled,
  getBlob,
  onPersisted,
}: UseDraftDocOptions): UseDraftDocReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const saveGenerationRef = useRef(0);

  // Construir la clave actual
  const key = userId && documentId
    ? draftStorage.keyFor('doc', userId, documentId, versionId)
    : null;

  useEffect(() => {
    saveGenerationRef.current += 1;
    setBannerDismissed(false);
  }, [key]);

  // ─── Verificar si existe borrador al montar o cambiar versión ───────────
  useEffect(() => {
    if (!key) {
      setHasDraft(false);
      setDraftMeta(null);
      return;
    }
    let cancelled = false;
    draftStorage.get(key).then((record: DraftRecord | null) => {
      if (cancelled) return;
      if (record && record.payload instanceof Blob) {
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

  const persistBlob = useCallback(async (blob: Blob | null, generation: number) => {
    if (!enabled || !key) return;
    if (generation !== saveGenerationRef.current) return;
    if (!blob || blob.size === 0) return;
    const meta: DraftMeta = {
      savedAt: new Date().toISOString(),
      resourceId: documentId!,
      versionId,
      versionNum,
      label,
      type: 'doc',
    };
    await draftStorage.set(key, blob, meta);
    onPersisted?.();
  }, [enabled, key, documentId, versionId, versionNum, label, onPersisted]);

  // ─── Guardar borrador (debounced) ────────────────────────────────────────
  const scheduleDraftSave = useCallback(() => {
    if (!enabled || !key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const generation = saveGenerationRef.current;
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        const blob = await getBlob();
        await persistBlob(blob, generation);
        // No marcar hasDraft=true aquí para no re-renderizar el banner
        // mientras el usuario está editando activamente
      } catch (err) {
        console.warn('[useDraftDoc] Error en guardado de borrador:', err);
      } finally {
        isSavingRef.current = false;
      }
    }, DEBOUNCE_MS);
  }, [enabled, key, getBlob, persistBlob]);

  const flushDraftSave = useCallback(async () => {
    if (!enabled || !key) return;
    const generation = saveGenerationRef.current;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      const blob = await getBlob();
      await persistBlob(blob, generation);
    } catch (err) {
      console.warn('[useDraftDoc] Error al volcar borrador:', err);
    } finally {
      isSavingRef.current = false;
    }
  }, [enabled, key, getBlob, persistBlob]);

  const saveProvidedBlob = useCallback(async (blob: Blob) => {
    const generation = saveGenerationRef.current;
    try {
      await persistBlob(blob, generation);
    } catch (err) {
      console.warn('[useDraftDoc] Error al guardar blob provisto:', err);
    }
  }, [persistBlob]);

  // ─── Eliminar borrador ───────────────────────────────────────────────────
  const clearDraft = useCallback(async () => {
    if (!key) return;
    saveGenerationRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await draftStorage.delete(key);
    setHasDraft(false);
    setDraftMeta(null);
    setBannerDismissed(false);
  }, [key]);

  const dismissDraftBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  // ─── Restaurar Blob ──────────────────────────────────────────────────────
  const restoreBlob = useCallback(async (): Promise<Blob | null> => {
    if (!key) return null;
    const record = await draftStorage.get(key);
    if (record?.payload instanceof Blob) return record.payload;
    return null;
  }, [key]);

  const showDraftBanner = hasDraft && !!draftMeta && !bannerDismissed;

  return {
    hasDraft,
    draftMeta,
    showDraftBanner,
    dismissDraftBanner,
    scheduleDraftSave,
    flushDraftSave,
    saveProvidedBlob,
    clearDraft,
    restoreBlob,
  };
}
