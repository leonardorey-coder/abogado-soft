/** Rutas legales para invitados (registro/login). En sesión se usan /terminos y /privacidad dentro de AppLayout. */
export const LEGAL_PUBLIC_PREFIX = "/legal" as const;

export function isPublicLegalPath(pathname: string): boolean {
  return pathname.startsWith(`${LEGAL_PUBLIC_PREFIX}/`);
}

export function legalDocumentPath(
  doc: "terminos" | "privacidad",
  pathname: string,
  search: string,
): string {
  if (isPublicLegalPath(pathname)) {
    return `${LEGAL_PUBLIC_PREFIX}/${doc}${search}`;
  }
  return `/${doc}${search}`;
}
