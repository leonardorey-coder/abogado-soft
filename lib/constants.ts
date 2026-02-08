// ============================================================================
// Constantes globales de la aplicación
// ============================================================================

/** Mapeo de roles internos (BD) → etiquetas amigables en la UI */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Abogado',
  asistente: 'Auxiliar',
};

/** Obtiene la etiqueta de UI para un rol de la BD */
export function getRoleLabel(role: string | undefined | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}
