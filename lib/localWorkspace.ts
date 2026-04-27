export interface LocalWorkspaceFolder {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface LocalWorkspaceState {
  activeFolderId: string | null;
  folders: LocalWorkspaceFolder[];
}

const STORAGE_KEY = "abogadosoft.localWorkspace.v1";

const emptyState: LocalWorkspaceState = {
  activeFolderId: null,
  folders: [],
};

function safeParseState(raw: string | null): LocalWorkspaceState {
  if (!raw) return emptyState;
  try {
    const parsed = JSON.parse(raw) as LocalWorkspaceState;
    if (!Array.isArray(parsed.folders)) return emptyState;
    return {
      activeFolderId: parsed.activeFolderId ?? parsed.folders[0]?.id ?? null,
      folders: parsed.folders.filter((f) => f?.id && f?.path && f?.name),
    };
  } catch {
    return emptyState;
  }
}

export function readLocalWorkspace(): LocalWorkspaceState {
  if (typeof window === "undefined") return emptyState;
  return safeParseState(window.localStorage.getItem(STORAGE_KEY));
}

export function writeLocalWorkspace(state: LocalWorkspaceState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getFolderNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || "Carpeta local";
}

export function makeFolderId(path: string): string {
  return `folder_${btoa(unescape(encodeURIComponent(path))).replace(/=+$/g, "")}`;
}

export function upsertLocalFolder(
  state: LocalWorkspaceState,
  path: string,
  name = getFolderNameFromPath(path),
): LocalWorkspaceState {
  const existing = state.folders.find((folder) => folder.path === path);
  if (existing) {
    return { ...state, activeFolderId: existing.id };
  }

  const folder: LocalWorkspaceFolder = {
    id: makeFolderId(path),
    name,
    path,
    createdAt: new Date().toISOString(),
  };

  return {
    activeFolderId: folder.id,
    folders: [...state.folders, folder],
  };
}

export function removeLocalFolder(
  state: LocalWorkspaceState,
  folderId: string,
): LocalWorkspaceState {
  const folders = state.folders.filter((folder) => folder.id !== folderId);
  return {
    folders,
    activeFolderId: state.activeFolderId === folderId ? folders[0]?.id ?? null : state.activeFolderId,
  };
}
