import React, { useEffect, useMemo, useState } from "react";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  alt?: string;
  /** Fallback con iniciales en rectángulo (sin mascar circular). Por defecto círculo. */
  fallbackSquare?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildFallbackAvatar(name?: string | null, fallbackSquare?: boolean): string {
  const initials = getInitials(name);
  const rx = fallbackSquare ? 0 : 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="#dbeafe"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="700" fill="#1d4ed8">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  className = "",
  alt,
  fallbackSquare = false,
}) => {
  const fallbackSrc = useMemo(() => buildFallbackAvatar(name, fallbackSquare), [name, fallbackSquare]);
  const safeAvatarUrl = avatarUrl?.trim() ? avatarUrl.trim() : null;
  const [src, setSrc] = useState<string>(safeAvatarUrl ?? fallbackSrc);

  useEffect(() => {
    setSrc(safeAvatarUrl ?? fallbackSrc);
  }, [safeAvatarUrl, fallbackSrc]);

  return (
    <img
      src={src}
      alt={alt ?? name ?? "Usuario"}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
    />
  );
};
