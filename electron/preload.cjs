// ============================================================================
// Electron Preload — Expone APIs nativas al renderer de forma segura
// contextIsolation: true, nodeIntegration: false
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Guarda un archivo en la ruta local del usuario.
     * @param {string} filePath — Ruta absoluta del archivo destino.
     * @param {ArrayBuffer} buffer — Contenido del archivo como ArrayBuffer.
     * @returns {{ ok: boolean, error?: string }}
     */
    saveFile: (filePath, buffer) => ipcRenderer.invoke('fs:saveFile', filePath, buffer),

    /**
     * Abre un diálogo nativo para seleccionar carpeta.
     * @returns {Promise<string | null>} — Ruta seleccionada o null si canceló.
     */
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

    /** Carpetas comunes del sistema para configurar accesos rápidos. */
    getKnownFolders: () => ipcRenderer.invoke('app:getKnownFolders'),

    /** Abre un archivo local con la aplicación predeterminada del sistema. */
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

    /** Abre el menú nativo de compartir con un archivo temporal. */
    shareFile: (payload) => ipcRenderer.invoke('share:file', payload),

    /**
     * Une segmentos de ruta de forma nativa.
     * @param {...string} segments
     * @returns {string}
     */
    pathJoin: (...segments) => ipcRenderer.invoke('path:join', ...segments),

    /**
     * Verifica si una ruta/directorio existe.
     * @param {string} targetPath
     * @returns {boolean}
     */
    pathExists: (targetPath) => ipcRenderer.invoke('fs:pathExists', targetPath),

    /** Lista archivos soportados dentro de una carpeta local. */
    listFolderFiles: (folderPath) => ipcRenderer.invoke('fs:listFolderFiles', folderPath),

    /** Lee un archivo local para previsualizarlo o subirlo. */
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

    /** Indica que estamos en Electron */
    isElectron: true,
});
