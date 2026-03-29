// ============================================================================
// DiffSummaryPreview — Muestra resumen de líneas diff (verde/rojo) en la bitácora
// Recibe diffSummary del metadata del ActivityLog
// ============================================================================

import React, { useState } from "react";

export interface DiffSummary {
  linesAdded: number;
  linesRemoved: number;
  sampleLines: { type: "added" | "removed"; content: string }[];
}

interface DiffSummaryPreviewProps {
  diffSummary: DiffSummary;
  /** Modo compacto: solo muestra badges sin expandir. Default: false */
  compact?: boolean;
}

export const DiffSummaryPreview: React.FC<DiffSummaryPreviewProps> = ({
  diffSummary,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const { linesAdded, linesRemoved, sampleLines } = diffSummary;
  const hasChanges = linesAdded > 0 || linesRemoved > 0;
  const hasSampleLines = sampleLines && sampleLines.length > 0;

  if (!hasChanges) return null;

  return (
    <div className="mt-2">
      {/* Badges de conteo */}
      <div className="flex items-center gap-2 flex-wrap">
        {linesAdded > 0 && (
          <span
            style={{
              background: "rgba(22,163,74,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              color: "#16a34a",
              padding: "1px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: 0.2,
            }}
            className="dark:bg-green-900/20 dark:border-green-700/30 dark:text-green-400"
          >
            +{linesAdded}
          </span>
        )}
        {linesRemoved > 0 && (
          <span
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#dc2626",
              padding: "1px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: 0.2,
            }}
            className="dark:bg-red-900/20 dark:border-red-700/30 dark:text-red-400"
          >
            -{linesRemoved}
          </span>
        )}

        {/* Botón expandir/colapsar */}
        {!compact && hasSampleLines && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-medium text-[#616f89] dark:text-gray-500 hover:text-primary transition-colors flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[12px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
            {expanded ? "Ocultar" : "Ver cambios"}
          </button>
        )}
      </div>

      {/* Líneas de muestra */}
      {!compact && expanded && hasSampleLines && (
        <div
          className="mt-1.5 rounded-md overflow-hidden border border-gray-200 dark:border-gray-800"
          style={{
            fontFamily: "'Fira Mono', 'Courier New', monospace",
            fontSize: 11,
          }}
        >
          {sampleLines.map((line, idx) => (
            <div
              key={idx}
              style={{
                background:
                  line.type === "added"
                    ? "rgba(22,163,74,0.06)"
                    : "rgba(220,38,38,0.06)",
                borderLeft: `3px solid ${
                  line.type === "added" ? "#22c55e" : "#ef4444"
                }`,
                padding: "2px 8px",
                color:
                  line.type === "added"
                    ? "#15803d"
                    : "#b91c1c",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
              className={
                line.type === "added"
                  ? "dark:bg-green-900/10 dark:text-green-400"
                  : "dark:bg-red-900/10 dark:text-red-400"
              }
            >
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  fontWeight: 700,
                  userSelect: "none",
                  opacity: 0.7,
                  marginRight: 6,
                }}
              >
                {line.type === "added" ? "+" : "−"}
              </span>
              {line.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiffSummaryPreview;
