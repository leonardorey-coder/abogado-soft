interface ViewerLabelParams {
  subjectId?: string | null;
  subjectName?: string | null;
  currentUserId?: string | null;
  fallback?: string;
}

export function getViewerLabel({
  subjectId,
  subjectName,
  currentUserId,
  fallback = "Sistema",
}: ViewerLabelParams): string {
  if (subjectId && currentUserId && subjectId === currentUserId) {
    return "Tú";
  }

  const trimmedName = subjectName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return fallback;
}

export function getViewerInitial(params: ViewerLabelParams): string {
  const label = getViewerLabel(params);
  return label.charAt(0).toUpperCase();
}
