const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'AbogadoSoft',
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
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Seleccionar carpeta de guardado local',
  });
  return canceled ? null : filePaths[0];
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

