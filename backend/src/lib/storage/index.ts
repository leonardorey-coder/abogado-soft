// Re-exports del módulo de almacenamiento
export type { IStorageProvider, UploadResult } from './IStorageProvider.js';
export { getStorageProvider, resetStorageProvider } from './StorageFactory.js';
export { docKey, versionKey, pdfKey, backupKey } from './keys.js';
export { downloadDocumentBuffer, downloadDocumentBufferSafe } from './downloadHelper.js';
