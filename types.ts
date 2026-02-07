export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  DOCUMENTS = 'DOCUMENTS',
  ASIGNED = 'ASIGNED',
  AGREEMENTS = 'AGREEMENTS',
  EDITOR = 'EDITOR',
  EXCEL_EDITOR = 'EXCEL_EDITOR',
  ACTIVITY_LOG = 'ACTIVITY_LOG',
  SECURITY = 'SECURITY',
  TRASH = 'TRASH'
}

export type DocumentStatus = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO' | 'VISTO' | 'EDITADO';

export type FileStatus = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO';
export type CollaborationStatus = 'VISTO' | 'EDITADO' | 'COMENTADO' | 'REVISADO' | 'APROBADO' | 'PENDIENTE_REVISION' | 'RECHAZADO';
export type SharingStatus = 'ENVIADO' | 'ASIGNADO';

export type DocumentPermissionLevel = 'none' | 'download' | 'read' | 'write' | 'admin';

export interface DocumentPermissionEntry {
  userName: string;
  level: DocumentPermissionLevel;
}

export interface Agreement {
  id: string;
  institution: string;
  department: string;
  date: string;
  status: 'ACTIVO' | 'PENDIENTE' | 'EXPIRADO';
}

export interface Document {
  id: string;
  name: string;
  type: 'DOCX' | 'PDF' | 'XLSX';
  lastModified: string;
  timeAgo: string;
  status?: DocumentStatus;
  fileStatus: FileStatus;
  collaborationStatus?: CollaborationStatus;
  sharingStatus?: SharingStatus;
  expirationDate?: string;
  documentPermissions?: DocumentPermissionEntry[];
  currentUserPermission?: DocumentPermissionLevel;
}

export interface DocumentVersion {
  version: string;
  date: string;
  time: string;
  editor: string;
  note: string;
  isCurrent?: boolean;
}