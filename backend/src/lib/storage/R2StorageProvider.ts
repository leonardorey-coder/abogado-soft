// =============================================================================
// R2StorageProvider.ts — Implementación de IStorageProvider para Cloudflare R2
//
// Usa el SDK de AWS S3 v3 (compatible con R2 vía S3 API).
// Variables de entorno requeridas:
//   R2_ACCOUNT_ID        — Cloudflare Account ID
//   R2_ACCESS_KEY_ID     — API Token Access Key
//   R2_SECRET_ACCESS_KEY — API Token Secret
//   R2_BUCKET_NAME       — Nombre del bucket
//   R2_PUBLIC_URL        — (opcional) URL pública si el bucket tiene dominio custom
// =============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadBucketCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import type { IStorageProvider, UploadResult } from './IStorageProvider.js';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[R2StorageProvider] Variable de entorno faltante: ${key}`);
  return val;
}

export class R2StorageProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string | null;

  constructor() {
    this.bucket = getEnv('R2_BUCKET_NAME');
    this.publicUrl = process.env.R2_PUBLIC_URL || null;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${getEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: getEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  private buildPublicUrl(key: string): string | null {
    if (!this.publicUrl) return null;
    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  async upload(key: string, content: Buffer, mimeType: string): Promise<UploadResult> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: mimeType,
      ContentLength: content.byteLength,
    });
    const result = await this.client.send(cmd);
    return {
      storageKey: key,
      url: this.buildPublicUrl(key),
      etag: result.ETag ?? null,
    };
  }

  async update(key: string, content: Buffer, mimeType: string): Promise<UploadResult> {
    // En S3/R2, PUT sobreescribe — mismo código que upload
    return this.upload(key, content, mimeType);
  }

  async uploadStream(
    key: string,
    stream: Readable,
    mimeType: string,
    contentLength?: number
  ): Promise<UploadResult> {
    // Usa @aws-sdk/lib-storage para multipart upload en streams grandes
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: mimeType,
        ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
      },
    });
    const result = await upload.done();
    return {
      storageKey: key,
      url: this.buildPublicUrl(key),
      etag: result.ETag ?? null,
    };
  }

  async download(key: string): Promise<Buffer> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response: GetObjectCommandOutput = await this.client.send(cmd);

    if (!response.Body) {
      throw new Error(`[R2] Objeto vacío para key: ${key}`);
    }

    // Convertir el Body (ReadableStream de AWS SDK) a Buffer
    return streamToBuffer(response.Body as Readable);
  }

  async downloadStream(key: string): Promise<Readable> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response: GetObjectCommandOutput = await this.client.send(cmd);

    if (!response.Body) {
      throw new Error(`[R2] Objeto vacío para key: ${key}`);
    }

    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(cmd);
    // R2/S3 no lanza error si el objeto no existe — comportamiento idempotente
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 900
  ): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  async copy(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    const cmd = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });
    const result = await this.client.send(cmd);
    return {
      storageKey: destinationKey,
      url: this.buildPublicUrl(destinationKey),
      etag: result.CopyObjectResult?.ETag ?? null,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Helper: stream → Buffer ──────────────────────────────────────────────────
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
