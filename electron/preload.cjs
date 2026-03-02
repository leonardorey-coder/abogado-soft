// ============================================================================
// Electron Preload — Expone APIs nativas al renderer de forma segura
// contextIsolation: true, nodeIntegration: false
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Guarda un archivo en la ruta local del usuario.
     * @param {string} filePath — Ruta absoluta del archivo destino.
     * @param {ArrayBuffer} buffer — Contenido del archivo como ArrayBuffer.
     * @returns {{ ok: boolean, error?: string }}
     */
    saveFile: (filePath, buffer) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, Buffer.from(buffer));
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    /**
     * Abre un diálogo nativo para seleccionar carpeta.
     * @returns {Promise<string | null>} — Ruta seleccionada o null si canceló.
     */
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

    /**
     * Une segmentos de ruta de forma nativa.
     * @param {...string} segments
     * @returns {string}
     */
    pathJoin: (...segments) => path.join(...segments),

    /**
     * Verifica si una ruta/directorio existe.
     * @param {string} targetPath
     * @returns {boolean}
     */
    pathExists: (targetPath) => fs.existsSync(targetPath),

    /** Indica que estamos en Electron */
    isElectron: true,
});
