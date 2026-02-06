export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  AGREEMENTS = 'AGREEMENTS',
  EDITOR = 'EDITOR',
  EXCEL_EDITOR = 'EXCEL_EDITOR',
  ACTIVITY_LOG = 'ACTIVITY_LOG',
  SECURITY = 'SECURITY'
}

export type DocumentStatus = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO' | 'VISTO' | 'EDITADO';

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
  expirationDate?: string;
}

export interface DocumentVersion {
  version: string;
  date: string;
  time: string;
  editor: string;
  note: string;
  isCurrent?: boolean;
}