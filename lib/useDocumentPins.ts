import { useCallback, useEffect, useState } from "react";
import { documentPinsApi } from "./api";

export function useDocumentPins() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await documentPinsApi.list();
      setPinnedIds(new Set((res.data ?? []).map((p) => p.documentId)));
    } catch {
      setPinnedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (documentId: string): Promise<boolean> => {
      const wasPinned = pinnedIds.has(documentId);
      const nextPinned = !wasPinned;
      setPinnedIds((prev) => {
        const n = new Set(prev);
        if (nextPinned) n.add(documentId);
        else n.delete(documentId);
        return n;
      });
      try {
        await documentPinsApi.set(documentId, nextPinned);
        return true;
      } catch {
        setPinnedIds((prev) => {
          const n = new Set(prev);
          if (nextPinned) n.delete(documentId);
          else n.add(documentId);
          return n;
        });
        return false;
      }
    },
    [pinnedIds],
  );

  return { pinnedIds, loading, refresh, toggle };
}
