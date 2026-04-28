import React from "react";

export const BRAND_ISOLOGO_SRC = "/sidoc_isologo.png";
export const BRAND_WORDMARK_SRC = "/logo_letras.png";

export type AppBrandWordmark = "always" | "responsive" | "never";

type AppBrandSize = "sm" | "md" | "lg";

const isoClass: Record<AppBrandSize, string> = {
  sm: "h-8 w-8 shrink-0 object-contain",
  md: "h-9 w-9 shrink-0 object-contain",
  lg: "h-12 w-12 sm:h-14 sm:w-14 shrink-0 object-contain",
};

const wordClass: Record<AppBrandSize, string> = {
  sm: "h-5 w-auto max-w-[min(140px,40vw)] bg-transparent object-contain object-left",
  md: "h-6 w-auto max-w-[min(180px,45vw)] bg-transparent object-contain object-left",
  lg: "h-8 sm:h-9 w-auto max-w-[min(220px,55vw)] bg-transparent object-contain object-left",
};

export interface AppBrandProps {
  size?: AppBrandSize;
  wordmark?: AppBrandWordmark;
  onClick?: () => void;
  className?: string;
}

export const AppBrand: React.FC<AppBrandProps> = ({
  size = "md",
  wordmark = "responsive",
  onClick,
  className = "",
}) => {
  const wordmarkClass =
    wordmark === "always"
      ? "block"
      : wordmark === "never"
        ? "hidden"
        : "hidden md:block";

  const inner = (
    <>
      <img
        src={BRAND_ISOLOGO_SRC}
        alt={wordmark === "never" ? "SIDOC" : ""}
        className={isoClass[size]}
      />
      {wordmark !== "never" && (
        <img
          src={BRAND_WORDMARK_SRC}
          alt=""
          className={`${wordClass[size]} ${wordmarkClass}`}
          aria-hidden
        />
      )}
    </>
  );

  const wrapClass = `inline-flex items-center gap-2 min-w-0 rounded-xl ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${wrapClass} cursor-pointer border-0 bg-transparent p-0 text-left hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
        aria-label="SIDOC, ir al inicio"
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className={wrapClass}
      {...(wordmark !== "never" ? { role: "img" as const, "aria-label": "SIDOC" } : {})}
    >
      {inner}
    </span>
  );
};
