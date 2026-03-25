import React, { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";

const PAGE_SEL = ".superdoc-layout .superdoc-page";

type Props = {
  editorMountRef: React.RefObject<HTMLElement | null>;
  activePageIndex: number;
  onActiveChange: (i: number) => void;
  collapsed?: boolean;
};

export const SuperDocPageStrip: React.FC<Props> = ({
  editorMountRef,
  activePageIndex,
  onActiveChange,
  collapsed = false,
}) => {
  const [pageCount, setPageCount] = useState(0);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const genRef = useRef(0);

  const refreshPages = useCallback(() => {
    const root = editorMountRef.current;
    if (!root) return;
    const pages = root.querySelectorAll(PAGE_SEL);
    setPageCount(pages.length);
  }, [editorMountRef]);

  useEffect(() => {
    const root = editorMountRef.current;
    if (!root) return;
    refreshPages();
    const mo = new MutationObserver(() => refreshPages());
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [editorMountRef, refreshPages]);

  useEffect(() => {
    if (collapsed || pageCount === 0) return;
    const root = editorMountRef.current;
    if (!root) return;
    const pages = root.querySelectorAll(PAGE_SEL);
    const id = ++genRef.current;
    const run = async () => {
      const next: Record<number, string> = {};
      for (let i = 0; i < pages.length; i++) {
        if (genRef.current !== id) return;
        const el = pages[i] as HTMLElement;
        if (i >= 12) continue;
        try {
          const dataUrl = await toPng(el, {
            cacheBust: true,
            pixelRatio: 0.4,
            backgroundColor: "#ffffff",
            skipFonts: true,
          });
          next[i] = dataUrl;
        } catch {
          /* fuentes/canvas pueden fallar; se muestra solo el número */
        }
        setThumbs((prev) => ({ ...prev, ...next }));
      }
    };
    const t = window.setTimeout(run, 400);
    return () => {
      window.clearTimeout(t);
      genRef.current++;
    };
  }, [collapsed, pageCount, editorMountRef]);

  const scrollToPage = (index: number) => {
    const root = editorMountRef.current;
    if (!root) return;
    const pages = root.querySelectorAll(PAGE_SEL);
    const el = pages[index] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      onActiveChange(index);
    }
  };

  useEffect(() => {
    const root = editorMountRef.current;
    if (!root || pageCount === 0) return;
    const pages = root.querySelectorAll(PAGE_SEL);
    const io = new IntersectionObserver(
      (entries) => {
        let best = -1;
        let bestRatio = 0;
        entries.forEach((en) => {
          const idx = Number((en.target as HTMLElement).dataset.pageStripIndex);
          if (!Number.isFinite(idx)) return;
          if (en.intersectionRatio > bestRatio) {
            bestRatio = en.intersectionRatio;
            best = idx;
          }
        });
        if (best >= 0 && bestRatio > 0.12) onActiveChange(best);
      },
      { root, rootMargin: "-12% 0px -48% 0px", threshold: [0, 0.12, 0.3, 0.55, 1] }
    );
    pages.forEach((p, i) => {
      (p as HTMLElement).dataset.pageStripIndex = String(i);
      io.observe(p);
    });
    return () => io.disconnect();
  }, [editorMountRef, pageCount, onActiveChange]);

  if (collapsed) return null;

  return (
    <aside className="flex w-[132px] lg:w-[148px] shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f0f1a] overflow-y-auto max-h-[min(100vh-12rem,900px)]">
      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Páginas
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{pageCount || "…"}</p>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {pageCount === 0 ? (
          <p className="text-xs text-gray-500 px-1">Cargando…</p>
        ) : (
          Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              className={`rounded-lg border text-left transition-colors overflow-hidden ${
                activePageIndex === i
                  ? "border-primary ring-2 ring-primary/30 bg-white dark:bg-gray-900"
                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-primary/50"
              }`}
            >
              <div
                className="aspect-[210/297] w-full bg-white flex items-center justify-center relative"
                style={{ maxHeight: 120 }}
              >
                {thumbs[i] ? (
                  <img src={thumbs[i]} alt="" className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="text-[10px] text-gray-400 font-medium">Pág. {i + 1}</span>
                )}
              </div>
              <div className="px-1.5 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-300 text-center border-t border-gray-100 dark:border-gray-800">
                {i + 1}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
