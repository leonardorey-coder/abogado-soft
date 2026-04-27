/// <reference types="vite/client" />

interface ElectronOpenPathResult {
  ok: boolean;
  error?: string;
}

interface ElectronKnownFolders {
  desktop: string;
  documents: string;
  downloads: string;
}

interface ElectronLocalFile {
  name: string;
  path: string;
  ext: string;
  size: number;
  mtimeMs: number;
  modifiedAt: string;
  mimeType: string;
}

interface Window {
  electronAPI?: {
    saveFile: (filePath: string, buffer: ArrayBuffer) => Promise<{ ok: boolean; error?: string }>;
    selectFolder: () => Promise<string | null>;
    getKnownFolders: () => Promise<ElectronKnownFolders>;
    openPath: (filePath: string) => Promise<ElectronOpenPathResult>;
    pathJoin: (...segments: string[]) => Promise<string>;
    pathExists: (targetPath: string) => Promise<boolean>;
    listFolderFiles: (folderPath: string) => Promise<{ ok: boolean; files: ElectronLocalFile[]; error?: string }>;
    readFile: (filePath: string) => Promise<{ ok: boolean; buffer?: ArrayBuffer; mimeType?: string; error?: string }>;
    isElectron: true;
  };
}
