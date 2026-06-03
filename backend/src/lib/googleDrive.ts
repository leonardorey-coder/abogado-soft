import { Readable } from 'stream';

const disabledMessage = 'Google Drive legacy storage is disabled. Use the R2 storage provider.';

function disabledError(): Error {
  return new Error(disabledMessage);
}

export interface DriveUploadResult {
  driveFileId: string;
  driveRevisionId: string | null;
}

export interface DriveRevision {
  id: string;
  modifiedTime: string | null;
  keepForever: boolean | null;
}

export interface ResumableUploadSession {
  fileId: string;
  uploadUrl: string;
}

export function getOAuth2FallbackClient(): null {
  return null;
}

export function getAuthClient(): never {
  throw disabledError();
}

export function getDriveClient(): never {
  throw disabledError();
}

export function resetDriveClient(): void {
}

export async function getOrCreateFolder(..._args: unknown[]): Promise<string> {
  throw disabledError();
}

export async function uploadFile(..._args: unknown[]): Promise<DriveUploadResult> {
  throw disabledError();
}

export async function uploadFileStream(..._args: unknown[]): Promise<DriveUploadResult> {
  throw disabledError();
}

export async function updateFile(..._args: unknown[]): Promise<{ driveRevisionId: string | null }> {
  throw disabledError();
}

export async function downloadFile(..._args: unknown[]): Promise<Buffer> {
  throw disabledError();
}

export async function downloadFileStream(..._args: unknown[]): Promise<Readable> {
  throw disabledError();
}

export async function getRevisions(..._args: unknown[]): Promise<DriveRevision[]> {
  throw disabledError();
}

export async function downloadRevision(..._args: unknown[]): Promise<Buffer> {
  throw disabledError();
}

export async function deleteFile(..._args: unknown[]): Promise<void> {
}

export async function createResumableUploadSession(..._args: unknown[]): Promise<ResumableUploadSession> {
  throw disabledError();
}

export async function verifyCredentials(): Promise<boolean> {
  return false;
}
