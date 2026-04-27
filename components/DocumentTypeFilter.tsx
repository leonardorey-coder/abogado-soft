import React from "react";
import { Layers } from "lucide-react";

export type DocumentTypeFilterValue = "TODOS" | "DOCX" | "XLSX" | "PDF";

export type DocumentTypeCounts = Record<DocumentTypeFilterValue, number>;

interface DocumentTypeFilterProps {
  value: DocumentTypeFilterValue;
  onChange: (value: DocumentTypeFilterValue) => void;
  counts: Partial<DocumentTypeCounts>;
}

function OfficeTypeIcon({ type }: { type: Exclude<DocumentTypeFilterValue, "TODOS"> }) {
  const iconMap = {
    DOCX: { letter: "W", left: "fill-[#185ABD]" },
    XLSX: { letter: "X", left: "fill-[#107C41]" },
    PDF: { letter: "PDF", left: "fill-[#B30B00]" },
  } as const;
  const icon = iconMap[type];
  const letterSize = type === "PDF" ? "text-[5px]" : "text-[9px]";

  return (
    <span className="inline-flex h-5 w-[18px] items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-5 w-[18px]" aria-hidden="true">
        <rect x="2" y="3" width="20" height="18" rx="3" className={icon.left} />
        <text
          x="12"
          y="12.5"
          textAnchor="middle"
          dominantBaseline="middle"
          className={`fill-white font-black tracking-tight ${letterSize}`}
        >
          {icon.letter}
        </text>
      </svg>
    </span>
  );
}

export function DocumentTypeFilter({ value, onChange, counts }: DocumentTypeFilterProps) {
  const items: Array<{
    value: DocumentTypeFilterValue;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    { value: "TODOS", label: "Todos", icon: <Layers className="h-4 w-4" />, activeClass: "text-slate-900 dark:text-white" },
    { value: "DOCX", label: "Word", icon: <OfficeTypeIcon type="DOCX" />, activeClass: "text-blue-700 dark:text-blue-200" },
    { value: "XLSX", label: "Excel", icon: <OfficeTypeIcon type="XLSX" />, activeClass: "text-emerald-700 dark:text-emerald-200" },
    { value: "PDF", label: "PDF", icon: <OfficeTypeIcon type="PDF" />, activeClass: "text-red-700 dark:text-red-200" },
  ];
  const selectedIndex = Math.max(items.findIndex((item) => item.value === value), 0);

  return (
    <div className="flex min-w-[11rem] flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tipo</span>
      <div className="relative inline-flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        <div
          className="pointer-events-none absolute bottom-1 top-1 w-10 rounded-lg bg-slate-100 shadow-sm transition-transform duration-300 ease-out dark:bg-slate-700/80"
          style={{ transform: `translateX(${selectedIndex * 2.75}rem)` }}
        />
        {items.map((item) => {
          const active = value === item.value;
          const count = counts[item.value] ?? 0;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              title={`${item.label} (${count})`}
              aria-label={`${item.label} (${count})`}
              className={`relative z-[1] flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg transition-colors ${
                active ? item.activeClass : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {item.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
