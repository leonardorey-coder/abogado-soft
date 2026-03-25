import React, { useEffect, useState } from "react";
import type { SuperDoc } from "superdoc";

type Props = {
  open: boolean;
  superdoc: SuperDoc | null;
  onClose: () => void;
};

type Margins = { top: string; right: string; bottom: string; left: string };
type Orientation = "portrait" | "landscape";

export const SuperDocPageSetupModal: React.FC<Props> = ({ open, superdoc, onClose }) => {
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState<Margins>({
    top: "2.5",
    right: "2.5",
    bottom: "2.5",
    left: "2.5",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !superdoc) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ed = (superdoc as unknown as { activeEditor?: unknown }).activeEditor as
          | {
              doc?: {
                sections?: {
                  list?: (opts?: object) => Promise<{
                    items?: Array<{
                      address?: { sectionId?: string };
                      margins?: Partial<Record<keyof Margins, number>>;
                      pageSetup?: { orientation?: Orientation };
                    }>;
                  }>;
                  setPageSetup?: (opts: object) => Promise<unknown>;
                  setPageMargins?: (opts: object) => Promise<unknown>;
                };
              };
            }
          | undefined;
        const list = ed?.doc?.sections?.list;
        if (typeof list !== "function") {
          throw new Error("Este documento no expone la API de secciones.");
        }
        const res = await list({});
        const first = res?.items?.[0];
        const sid = first?.address?.sectionId;
        if (!sid) throw new Error("No se encontró una sección en el documento.");
        if (cancelled) return;
        setSectionId(sid);
        const m = first?.margins;
        if (m) {
          setMargins({
            top: m.top != null ? String(m.top) : margins.top,
            right: m.right != null ? String(m.right) : margins.right,
            bottom: m.bottom != null ? String(m.bottom) : margins.bottom,
            left: m.left != null ? String(m.left) : margins.left,
          });
        }
        const o = first?.pageSetup?.orientation;
        if (o === "landscape" || o === "portrait") setOrientation(o);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al leer la página");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, superdoc]);

  const apply = async () => {
    if (!superdoc || !sectionId) return;
    setSaving(true);
    setError(null);
    try {
      const ed = (superdoc as unknown as { activeEditor?: unknown }).activeEditor as
        | {
            doc?: {
              sections?: {
                setPageSetup?: (opts: object) => Promise<unknown>;
                setPageMargins?: (opts: object) => Promise<unknown>;
              };
            };
          }
        | undefined;
      const sections = ed?.doc?.sections;
      if (!sections?.setPageSetup || !sections?.setPageMargins) {
        throw new Error("No se pueden aplicar cambios de página en este entorno.");
      }
      const target = { kind: "section" as const, sectionId };
      await sections.setPageSetup({ target, orientation });
      const sides: (keyof Margins)[] = ["top", "right", "bottom", "left"];
      for (const side of sides) {
        const raw = parseFloat(margins[side].replace(",", "."));
        if (Number.isNaN(raw) || raw < 0) continue;
        await sections.setPageMargins({ target, [side]: raw });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configurar página</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {loading && <p className="text-sm text-gray-500">Leyendo sección actual…</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Orientación</label>
                <div className="flex gap-2">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOrientation(o)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                        orientation === o
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {o === "portrait" ? "Vertical" : "Horizontal"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                  Márgenes (mismas unidades que el documento)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(margins) as (keyof Margins)[]).map((k) => (
                    <div key={k}>
                      <span className="text-[10px] text-gray-400 capitalize">{k}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={margins[k]}
                        onChange={(e) => setMargins((m) => ({ ...m, [k]: e.target.value }))}
                        className="w-full mt-0.5 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading || !!error || !sectionId}
            onClick={() => void apply()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
};
