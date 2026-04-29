// =============================================================================
// LocalStorageProvider.ts — Implementación de IStorageProvider para disco local
//
// Usada en desarrollo/testing cuando no hay credenciales de R2.
// Almacena archivos en LOCAL_STORAGE_PATH (default: ./local-storage).
//
// getSignedUrl() devuelve una URL interna del backend para poder servir
// los archivos en desarrollo sin exponer rutas del filesystem.
// =============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Readable } from 'stream';
import { Writable } from 'stream';
import type { IStorageProvider, UploadResult } from './IStorageProvider.js';

export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;
  private devServerUrl: string;

  constructor() {
    this.basePath = path.resolve(
      process.env.LOCAL_STORAGE_PATH ??
      path.join(process.cwd(), 'local-storage')
    );
    this.devServerUrl = `http://localhost:${process.env.PORT ?? 4000}`;
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  private resolve(key: string): string {
    // Prevenir path traversal
    const safe = key.replace(/\.\./g, '_');
    return path.join(this.basePath, safe);
  }

  private checksum(content: Buffer): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async upload(key: string, content: Buffer, _mimeType: string): Promise<UploadResult> {
    const filePath = this.resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    return {
      storageKey: key,
      url: `${this.devServerUrl}/api/storage/dev-file?key=${encodeURIComponent(key)}`,
      etag: this.checksum(content),
    };
  }

  async update(key: string, content: Buffer, mimeType: string): Promise<UploadResult> {
    return this.upload(key, content, mimeType);
  }

  async uploadStream(
    key: string,
    stream: Readable,
    _mimeType: string,
    _contentLength?: number
  ): Promise<UploadResult> {
    const filePath = this.resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    return new Promise<UploadResult>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const writeStream: Writable = fs.createWriteStream(filePath);
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.pipe(writeStream);
      writeStream.on('finish', () => {
        const content = Buffer.concat(chunks);
        resolve({
          storageKey: key,
          url: `${this.devServerUrl}/api/storage/dev-file?key=${encodeURIComponent(key)}`,
          etag: this.checksum(content),
        });
      });
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.resolve(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`[LocalStorage] Archivo no encontrado: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  async downloadStream(key: string): Promise<Readable> {
    const filePath = this.resolve(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`[LocalStorage] Archivo no encontrado: ${key}`);
    }
    return fs.createReadStream(filePath) as unknown as Readable;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolve(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // No lanza si no existe — comportamiento idempotente
  }

  async getSignedUrl(key: string, _expiresInSeconds = 900): Promise<string> {
    // En desarrollo: URL interna del backend (no hay expiración real)
    return `${this.devServerUrl}/api/storage/dev-file?key=${encodeURIComponent(key)}`;
  }

  async getSignedUploadUrl(
    key: string,
    _mimeType: string,
    _expiresInSeconds = 900
  ): Promise<string> {
    return `${this.devServerUrl}/api/storage/dev-upload?key=${encodeURIComponent(key)}`;
  }

  async copy(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    const srcPath = this.resolve(sourceKey);
    const dstPath = this.resolve(destinationKey);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`[LocalStorage] Fuente no encontrada para copy: ${sourceKey}`);
    }
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    const content = fs.readFileSync(dstPath);
    return {
      storageKey: destinationKey,
      url: `${this.devServerUrl}/api/storage/dev-file?key=${encodeURIComponent(destinationKey)}`,
      etag: this.checksum(content),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      fs.mkdirSync(this.basePath, { recursive: true });
      fs.accessSync(this.basePath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}
