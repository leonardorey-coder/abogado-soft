const { app, BrowserWindow, ipcMain, dialog, shell, ShareMenu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const isDev = !app.isPackaged;
const SUPPORTED_LOCAL_EXTENSIONS = new Set(['.doc', '.docx', '.pdf', '.xls', '.xlsx', '.txt', '.rtf']);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.rtf') return 'application/rtf';
  return 'application/octet-stream';
}

function safeFileName(fileName) {
  const base = path.basename(fileName || 'documento');
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'documento';
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', isDev ? 'public' : 'dist', 'sidoc_isologo.png');
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'SIDOC',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    // En desarrollo, usa el servidor de Vite
    const devServerURL = 'http://localhost:3000';
    mainWindow.loadURL(devServerURL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // En producción, carga los archivos generados por Vite
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }
}

// ─── IPC: Diálogo nativo para seleccionar carpeta ───────────────────────
ipcMain.handle('dialog:selectFolder', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options = {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Seleccionar carpeta de guardado local',
  };
  const { canceled, filePaths } = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);
  return canceled ? null : filePaths[0];
});

ipcMain.handle('app:getKnownFolders', async () => ({
  desktop: app.getPath('desktop'),
  documents: app.getPath('documents'),
  downloads: app.getPath('downloads'),
}));

ipcMain.handle('shell:openPath', async (_event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'Ruta inválida' };
  }
  const error = await shell.openPath(filePath);
  return error ? { ok: false, error } : { ok: true };
});

ipcMain.handle('share:file', async (event, payload = {}) => {
  try {
    if (process.platform !== 'darwin' || typeof ShareMenu !== 'function') {
      return { ok: false, error: 'El menú nativo de compartir solo está disponible en macOS.' };
    }

    const { fileName, buffer, title, text, url, x, y } = payload;
    if (!buffer || !fileName) {
      return { ok: false, error: 'Archivo inválido para compartir' };
    }

    const shareDir = path.join(app.getPath('temp'), 'sidoc-shares');
    fs.mkdirSync(shareDir, { recursive: true });
    const filePath = path.join(shareDir, `${Date.now()}-${safeFileName(fileName)}`);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const sharingItem = { filePaths: [filePath] };
    if (text || title) sharingItem.texts = [text || title];
    if (url) sharingItem.urls = [url];
    const shareMenu = new ShareMenu(sharingItem);
    const browserWindow = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const popupOptions = {};
    if (browserWindow) popupOptions.browserWindow = browserWindow;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      popupOptions.x = Math.round(x);
      popupOptions.y = Math.round(y);
    }
    shareMenu.popup(popupOptions);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'No se pudo abrir el menú de compartir' };
  }
});

ipcMain.handle('fs:saveFile', async (_event, filePath, buffer) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: 'Ruta inválida' };
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'No se pudo guardar el archivo' };
  }
});

ipcMain.handle('fs:pathExists', async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') return false;
  return fs.existsSync(targetPath);
});

ipcMain.handle('path:join', async (_event, ...segments) => {
  return path.join(...segments.filter((segment) => typeof segment === 'string'));
});

ipcMain.handle('fs:listFolderFiles', async (_event, folderPath) => {
  try {
    if (!folderPath || typeof folderPath !== 'string') {
      return { ok: false, error: 'Ruta inválida', files: [] };
    }

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(folderPath, entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        if (!SUPPORTED_LOCAL_EXTENSIONS.has(ext)) return null;
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          path: filePath,
          ext: ext.replace('.', ''),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          modifiedAt: stat.mtime.toISOString(),
          mimeType: getMimeType(filePath),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'No se pudo leer la carpeta', files: [] };
  }
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: 'Ruta inválida' };
    }
    const buffer = fs.readFileSync(filePath);
    return { ok: true, buffer, mimeType: getMimeType(filePath) };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'No se pudo leer el archivo' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

