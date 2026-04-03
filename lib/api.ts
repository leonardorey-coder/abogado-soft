// ============================================================================
// Capa de servicios API — Cliente HTTP centralizado
// Conecta el frontend con el backend Express/Prisma en localhost:4000
// ============================================================================

import { supabase } from './supabaseAuth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// ─── Helper para obtener token ──────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ─── Fetch genérico con auth automática ─────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new ApiError(res.status, body.error ?? body.message ?? 'Error desconocido');
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Fetch para subir archivos con FormData (sin Content-Type manual,
 * el navegador lo pone automáticamente con boundary).
 */
async function apiFetchUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new ApiError(res.status, body.error ?? body.message ?? 'Error desconocido');
  }

  return res.json();
}

/** Construye la URL para servir/previsualizar el archivo de un documento */
export function getDocumentFileUrl(documentId: string): string {
  return `${API_URL}/documents/${documentId}/file`;
}

/** Construye la URL para servir/previsualizar el archivo de una versión específica */
export function getDocumentVersionFileUrl(documentId: string, versionId: string): string {
  return `${API_URL}/documents/${documentId}/versions/${versionId}/file`;
}

/** Construye la URL para descargar el archivo de un documento */
export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_URL}/documents/${documentId}/download`;
}

/** Descarga un documento con autenticación (evita 401 en window.open) */
export async function downloadDocument(documentId: string, fileName?: string): Promise<void> {
  const token = await getAccessToken();
  const url = getDocumentDownloadUrl(documentId);

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new ApiError(res.status, body.error ?? 'Error al descargar el archivo');
  }

  // Obtener el nombre del archivo del header Content-Disposition o usar el proporcionado
  const contentDisposition = res.headers.get('Content-Disposition');
  let downloadName = fileName ?? 'documento';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      downloadName = match[1].replace(/['"]/g, '');
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/** Obtiene el File de un documento con autenticación para compartirlo en Web Share API */
export async function getShareableDocumentFile(documentId: string, fileName?: string): Promise<File> {
  const token = await getAccessToken();
  const url = getDocumentDownloadUrl(documentId);

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new ApiError(res.status, body.error ?? 'Error al obtener el archivo para compartir');
  }

  const contentDisposition = res.headers.get('Content-Disposition');
  let downloadName = fileName ?? 'documento';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      downloadName = match[1].replace(/['"]/g, '');
    }
  }

  const blob = await res.blob();
  const mimeType = res.headers.get('Content-Type') || (downloadName.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream');
  return new File([blob], downloadName, { type: mimeType });
}

/** Descarga un respaldo con autenticación */
export async function downloadBackup(id: string, fileName?: string): Promise<void> {
  const token = await getAccessToken();
  const url = `${API_URL}/backups/${id}/download`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new ApiError(res.status, body.error ?? 'Error al descargar el respaldo');
  }

  const contentDisposition = res.headers.get('Content-Disposition');
  let downloadName = fileName ?? 'respaldo.zip';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      downloadName = match[1].replace(/['"]/g, '');
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Tipos de respuesta del backend ─────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Backend devuelve `{ data, total, page, limit }` plano en varios listados. */
function normalizeFlatPagination<T>(raw: {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
}): PaginatedResponse<T> {
  const total = Number(raw.total) || 0;
  const page = Number(raw.page) || 1;
  const limit = Number(raw.limit) || 20;
  return {
    data: Array.isArray(raw.data) ? raw.data : [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export interface ApiDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  localPath: string | null;
  cloudUrl: string | null;
  ownerId: string | null;
  groupId: string | null;
  caseId: string | null;
  fileStatus: string;
  collaborationStatus: string | null;
  sharingStatus: string | null;
  version: number;
  checksum: string | null;
  expirationDate: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  description: string | null;
  tags: string[];
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  // Google Drive sync
  syncStatus?: string;
  driveFileId?: string | null;
  lastSyncAt?: string | null;
  // Permiso efectivo del usuario actual sobre este documento
  effectivePermission?: 'none' | 'download' | 'read' | 'write' | 'admin';
  owner?: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  group?: { id: string; name: string } | null;
  case_?: {
    id: string;
    caseNumber: string;
    title: string;
    client: string | null;
    court: string | null;
    caseType: string | null;
    status: string;
    description: string | null;
    startDate: string | null;
  } | null;
  permissions?: ApiDocumentPermission[];
  versions?: ApiDocumentVersion[];
  comments?: ApiDocumentComment[];
  assignments?: ApiDocumentAssignment[];
  recentShares?: ApiDocumentShare[];
}

export interface ApiDocumentPermission {
  id: string;
  permissionLevel: string;
  userId: string | null;
  groupId: string | null;
  user?: { id: string; name: string; email: string } | null;
  group?: { id: string; name: string } | null;
}

export interface ApiDocumentVersion {
  id: string;
  version: number;
  size: string;
  changeNote: string | null;
  createdAt: string;
  creator?: { id: string; name: string } | null;
}

export interface ApiDocumentComment {
  id: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  replies?: ApiDocumentComment[];
}

export interface ApiDocumentAssignment {
  id: string;
  status: string;
  notes: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: { id: string; name: string; email: string };
  assigner: { id: string; name: string; email: string };
  document?: { id: string; name: string; type: string };
}

export interface ApiDocumentShare {
  sharedWith: string;
  shareMethod: 'email' | 'whatsapp' | 'link' | 'system' | 'other';
  sharedAt: string;
  sharedBy: { id: string; name: string } | null;
}

export interface ApiConvenioVersion {
  id: string;
  version: number;
  size: number;
  changeNote: string | null;
  snapshotData?: any;
  createdAt: string;
  creator?: { id: string; name: string } | null;
}

export interface ApiConvenioComment {
  id: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  replies?: ApiConvenioComment[];
}

export interface TableData {
  columns: { id: string; name: string; type: 'text' | 'date' | 'status' | 'number' }[];
  rows: { id: string; cells: Record<string, string> }[];
}

export interface ApiConvenio {
  id: string;
  numero: string;
  institucion: string;
  departamento: string | null;
  descripcion: string | null;
  fechaInicio: string;
  fechaFin: string;
  responsableId: string | null;
  estado: string;
  notas: string | null;
  monto: string | null;
  version: number;
  tableData: TableData | null;
  createdAt: string;
  updatedAt: string;
  responsable?: { id: string; name: string; email: string } | null;
  documents?: { document: { id: string; name: string; type: string; fileStatus: string } }[];
  versions?: ApiConvenioVersion[];
  comments?: ApiConvenioComment[];
  _count?: { documents: number };
}

export interface ApiCase {
  id: string;
  caseNumber: string;
  title: string;
  client: string | null;
  court: string | null;
  caseType: string | null;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  responsibleId: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: { id: string; name: string } | null;
  _count?: { documents: number; caseDocuments: number };
}

export interface ApiActivityLog {
  id: string;
  userId: string | null;
  activity: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; avatarUrl: string | null } | null;
}

export interface ApiNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ApiBackup {
  id: string;
  name: string;
  type: string;
  status: string;
  documentsCount: number;
  size: string | null;
  filePath: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  creator?: { id: string; name: string };
  progress?: number;
}

export interface ApiGroup {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string | null;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  owner?: { id: string; name: string; email: string };
  _count?: { members: number; documents: number };
  members?: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  officeName: string | null;
  department: string | null;
  position: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

// ─── DOCUMENTOS ─────────────────────────────────────────────────────────

export const documentsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    fileStatus?: string;
    groupId?: string;
    caseId?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<ApiDocument>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.fileStatus) query.set('status', params.fileStatus);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.caseId) query.set('caseId', params.caseId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    const raw = await apiFetch<{
      data: ApiDocument[];
      total: number;
      page: number;
      limit: number;
    }>(`/documents${qs ? `?${qs}` : ''}`);
    return normalizeFlatPagination(raw);
  },

  get: (id: string) => apiFetch<ApiDocument>(`/documents/${id}`),

  create: (data: {
    name: string;
    type: string;
    size?: number;
    localPath?: string;
    cloudUrl?: string;
    groupId?: string;
    caseId?: string;
    description?: string;
    tags?: string[];
    mimeType?: string;
    expirationDate?: string;
  }) => apiFetch<ApiDocument>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Partial<{
    name: string;
    fileStatus: string;
    collaborationStatus: string;
    sharingStatus: string;
    description: string;
    tags: string[];
    expirationDate: string | null;
    groupId: string | null;
    caseId: string | null;
  }>) => apiFetch<ApiDocument>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiFetch<ApiDocument>(`/documents/${id}`, {
    method: 'DELETE',
  }),

  restore: (id: string) => apiFetch<ApiDocument>(`/documents/${id}/restore`, {
    method: 'POST',
  }),

  listTrash: async (): Promise<ApiDocument[]> => {
    const res = await apiFetch<{ data: ApiDocument[]; total: number }>('/documents/trash');
    return (res as any).data ?? res;
  },

  permanentDelete: (id: string) => apiFetch<{ message: string }>(`/documents/${id}/permanent`, {
    method: 'DELETE',
  }),

  createVersion: (id: string, data: { changeNote?: string }) =>
    apiFetch<ApiDocumentVersion>(`/documents/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateVersionNote: (id: string, versionId: string, data: { changeNote?: string | null }) =>
    apiFetch<ApiDocumentVersion>(`/documents/${id}/versions/${versionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addComment: (id: string, data: { content: string; parentId?: string }) =>
    apiFetch<ApiDocumentComment>(`/documents/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Sube un archivo al backend y crea el registro de documento */
  upload: (file: File, metadata?: {
    name?: string;
    description?: string;
    groupId?: string;
    caseId?: string;
    tags?: string[];
  }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.name) formData.append('name', metadata.name);
    if (metadata?.description) formData.append('description', metadata.description);
    if (metadata?.groupId) formData.append('groupId', metadata.groupId);
    if (metadata?.caseId) formData.append('caseId', metadata.caseId);
    if (metadata?.tags) formData.append('tags', JSON.stringify(metadata.tags));
    return apiFetchUpload<ApiDocument>('/documents/upload', formData);
  },

  /** Extrae el contenido HTML de un documento (DOCX, TXT) para el editor */
  getContent: (id: string) =>
    apiFetch<{ html: string; messages?: any[] }>(`/documents/${id}/content`),

  /** Consulta el diff entre dos versiones */
  getDiff: (id: string, v1: number, v2: number) =>
    apiFetch<{ html: string }>(`/documents/${id}/diff?v1=${v1}&v2=${v2}`),

  /** Guarda el archivo del editor. createVersion=true crea nueva versión en el historial */
  saveVersion: (id: string, fileBlob: Blob, fileName: string, changeNote?: string, createVersion = false) => {
    const formData = new FormData();

    // Forzar el mimetype correcto de docx si el nombre termina en .docx o si superdoc devuelve application/zip
    const isDocx = fileName.toLowerCase().endsWith('.docx');
    const mimeType = isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : (fileBlob.type || 'application/octet-stream');

    const fileToUpload = new File([fileBlob], fileName, { type: mimeType });

    formData.append('file', fileToUpload);
    if (changeNote) formData.append('changeNote', changeNote);
    formData.append('createVersion', String(createVersion));
    return apiFetchUpload<{
      ok: boolean;
      version: number;
      size: number;
      localPath: string;
      syncResult: { ok: boolean; driveFileId?: string; error?: string } | null;
    }>(`/documents/${id}/save`, formData);
  },

  getXlsxData: (id: string) =>
    apiFetch<{ columns: TableData['columns']; rows: TableData['rows']; sheetNames: string[] }>(`/documents/${id}/xlsx-data`),

  saveXlsx: (id: string, tableData: TableData, changeNote?: string, createVersion = false) =>
    apiFetch<{ ok: boolean; version: number; size: number; syncResult: any }>(`/documents/${id}/save-xlsx`, {
      method: 'POST',
      body: JSON.stringify({ tableData, changeNote, createVersion }),
    }),

  /** Registra que el documento fue compartido con un contacto */
  share: (id: string, data: {
    sharedWith: string;
    shareMethod?: 'email' | 'whatsapp' | 'link' | 'system' | 'other';
    note?: string;
  }) =>
    apiFetch<{ ok: boolean; sharedWith: string; shareMethod: string }>(`/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Lista el historial de shares de un documento */
  getShares: (id: string) =>
    apiFetch<{ shares: ApiDocumentShare[] }>(`/documents/${id}/shares`),
};

// ─── PERMISOS DE DOCUMENTOS ─────────────────────────────────────────────

export interface SetPermissionPayload {
  userId?: string;
  groupId?: string;
  permissionLevel: 'none' | 'download' | 'read' | 'write' | 'admin';
  expiresAt?: string | null;
}

export const permissionsApi = {
  /** Lista todos los permisos de un documento + permiso efectivo del usuario actual */
  list: (documentId: string) =>
    apiFetch<{ permissions: ApiDocumentPermission[]; effectivePermission: string }>(
      `/documents/${documentId}/permissions`,
    ),

  /** Reemplaza todos los permisos del documento (batch upsert) */
  save: (documentId: string, permissions: SetPermissionPayload[]) =>
    apiFetch<{ permissions: ApiDocumentPermission[] }>(
      `/documents/${documentId}/permissions`,
      { method: 'PUT', body: JSON.stringify({ permissions }) },
    ),

  /** Crea o actualiza un permiso individual */
  add: (documentId: string, data: SetPermissionPayload) =>
    apiFetch<ApiDocumentPermission>(`/documents/${documentId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Elimina un permiso específico */
  remove: (documentId: string, permId: string) =>
    apiFetch<{ message: string }>(
      `/documents/${documentId}/permissions/${permId}`,
      { method: 'DELETE' },
    ),

  /** Obtiene el permiso efectivo del usuario actual sobre un documento */
  getEffective: (documentId: string) =>
    apiFetch<{ permission: string }>(`/documents/${documentId}/effective-permission`),
};

// ─── ACCESS PINS ────────────────────────────────────────────────────────────

export const accessPinApi = {
  /** Genera un PIN de acceso de un solo uso (solo admin) */
  generate: (documentId: string) =>
    apiFetch<{ pin: string; expiresAt: string; documentName: string }>(
      `/documents/${documentId}/access-pin`,
      { method: 'POST' },
    ),

  /** Canjea un PIN para obtener acceso completo al documento */
  redeem: (documentId: string, pin: string) =>
    apiFetch<{ message: string; permission: string }>(
      `/documents/${documentId}/redeem-pin`,
      { method: 'POST', body: JSON.stringify({ pin }) },
    ),
};

// ─── CONVENIOS ──────────────────────────────────────────────────────────

export const conveniosApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.estado) query.set('estado', params.estado);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiConvenio>>(`/convenios${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiFetch<ApiConvenio>(`/convenios/${id}`),

  create: (data: {
    numero: string;
    institucion: string;
    departamento?: string;
    descripcion?: string;
    fechaInicio: string;
    fechaFin: string;
    responsableId?: string;
    estado?: string;
    notas?: string;
    monto?: number;
  }) => apiFetch<ApiConvenio>('/convenios', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Partial<{
    institucion: string;
    departamento: string;
    descripcion: string;
    fechaInicio: string;
    fechaFin: string;
    responsableId: string;
    estado: string;
    notas: string;
    monto: number;
  }>) => apiFetch<ApiConvenio>(`/convenios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiFetch(`/convenios/${id}`, { method: 'DELETE' }),

  linkDocument: (id: string, documentId: string) =>
    apiFetch(`/convenios/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    }),

  unlinkDocument: (id: string, documentId: string) =>
    apiFetch(`/convenios/${id}/documents/${documentId}`, { method: 'DELETE' }),

  addComment: (id: string, data: { content: string; parentId?: string }) =>
    apiFetch<ApiConvenioComment>(`/convenios/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveTable: (id: string, tableData: TableData, changeNote?: string, createVersion = false) =>
    apiFetch<{ ok: boolean; version: number; versionId?: string }>(`/convenios/${id}/save-table`, {
      method: 'POST',
      body: JSON.stringify({ tableData, changeNote, createVersion }),
    }),

  createVersion: (id: string, changeNote?: string) =>
    apiFetch<ApiConvenioVersion>(`/convenios/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ changeNote }),
    }),

  exportXlsx: async (id: string, filename: string) => {
    const { supabase } = await import('./supabaseAuth');
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    const res = await fetch(`${API_URL}/convenios/${id}/export-xlsx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al exportar XLSX');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── CASOS / EXPEDIENTES ────────────────────────────────────────────────

export const casesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    caseType?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.caseType) query.set('caseType', params.caseType);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiCase>>(`/cases${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiFetch<ApiCase>(`/cases/${id}`),

  create: (data: {
    caseNumber: string;
    title: string;
    client?: string;
    court?: string;
    caseType?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    responsibleId?: string;
  }) => apiFetch<ApiCase>('/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: Partial<{
    title: string;
    client: string;
    court: string;
    caseType: string;
    status: string;
    description: string;
    startDate: string;
    endDate: string;
    responsibleId: string;
  }>) => apiFetch<ApiCase>(`/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  linkDocument: (id: string, documentId: string) =>
    apiFetch(`/cases/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    }),

  unlinkDocument: (id: string, documentId: string) =>
    apiFetch(`/cases/${id}/documents/${documentId}`, { method: 'DELETE' }),
};

// ─── ASIGNACIONES ───────────────────────────────────────────────────────

export const assignmentsApi = {
  listReceived: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    /** Asignaciones no completadas (pendiente, visto, editado, revisado, etc.) */
    pendingWork?: boolean;
  }): Promise<PaginatedResponse<ApiDocumentAssignment>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.pendingWork) query.set('pendingWork', 'true');
    const qs = query.toString();
    const raw = await apiFetch<{
      data: ApiDocumentAssignment[];
      total: number;
      page: number;
      limit: number;
    }>(`/assignments${qs ? `?${qs}` : ''}`);
    return normalizeFlatPagination(raw);
  },

  listSent: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<ApiDocumentAssignment>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const raw = await apiFetch<{
      data: ApiDocumentAssignment[];
      total: number;
      page: number;
      limit: number;
    }>(`/assignments/sent${qs ? `?${qs}` : ''}`);
    return normalizeFlatPagination(raw);
  },

  create: (data: {
    documentId: string;
    assignedTo: string;
    notes?: string;
    dueDate?: string;
  }) => apiFetch<ApiDocumentAssignment>('/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateStatus: (id: string, status: string) =>
    apiFetch<ApiDocumentAssignment>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  delete: (id: string) => apiFetch<{ message: string }>(`/assignments/${id}`, {
    method: 'DELETE',
  }),
};

// ─── ACTIVIDAD ──────────────────────────────────────────────────────────

export const activityApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    activity?: string;
    entityType?: string;
    entityId?: string;
    category?: string;
    from?: string;
    to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.activity) query.set('activity', params.activity);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.entityId) query.set('entityId', params.entityId);
    if (params?.category) query.set('category', params.category);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiActivityLog>>(`/activity${qs ? `?${qs}` : ''}`);
  },

  export: async (params?: {
    userId?: string;
    activity?: string;
    entityType?: string;
    category?: string;
    from?: string;
    to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.set('userId', params.userId);
    if (params?.activity) query.set('activity', params.activity);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.category) query.set('category', params.category);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);

    const token = await supabase.auth.getSession().then(({ data }) => data.session?.access_token);
    const qs = query.toString();
    const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}/activity/export${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error('Error al exportar la bitácora');

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'bitacora.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },

  stats: () => apiFetch<{
    todayCount: number;
    weekCount: number;
    byType: Array<{ activity: string; _count: number }>;
  }>('/activity/stats'),
};

// ─── GRUPOS ─────────────────────────────────────────────────────────────

export const groupsApi = {
  list: () => apiFetch<ApiGroup[]>('/groups'),

  get: (id: string) => apiFetch<ApiGroup>(`/groups/${id}`),

  create: (data: { name: string; description?: string }) =>
    apiFetch<ApiGroup>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addMember: (groupId: string, userId: string, role?: string) =>
    apiFetch(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  removeMember: (groupId: string, userId: string) =>
    apiFetch(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  join: (inviteCode: string) =>
    apiFetch('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),
};

// ─── USUARIOS ───────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiUser>>(`/users${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiFetch<ApiUser>(`/users/${id}`),
};

// ─── NOTIFICACIONES ─────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<{ data: ApiNotification[]; unreadCount: number }>(
      `/notifications${qs ? `?${qs}` : ''}`,
    );
  },

  markRead: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch('/notifications/read-all', { method: 'POST' }),
};

// ─── BACKUPS ────────────────────────────────────────────────────────────

export const backupsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiBackup>>(`/backups${qs ? `?${qs}` : ''}`);
  },

  create: (data: { name: string; type?: string }) =>
    apiFetch<ApiBackup>('/backups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => apiFetch<ApiBackup>(`/backups/${id}`),

  delete: (id: string) => apiFetch<{ message: string }>(`/backups/${id}`, {
    method: 'DELETE',
  }),

  latestDaily: () => apiFetch<{ available: boolean; backup?: ApiBackup }>('/backups/latest-daily'),

  download: async (id: string, name: string) => {
    const token = await getAccessToken();
    const url = `${API_URL}/backups/${id}/download`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Error al descargar respaldo');

    let downloadName = `${name}.zip`;
    const contentDisposition = res.headers.get('Content-Disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match?.[1]) downloadName = match[1].replace(/['"]/g, '');
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }
};

// ─── ABIERTO RECIENTEMENTE ──────────────────────────────────────────────

export interface RecentlyOpenedItem {
  id: string;
  name: string;
  type?: string;
  fileStatus?: string;
  estado?: string;
  updatedAt: string;
  openedAt: string;
  entityType: 'document' | 'convenio';
  owner?: { id: string; name: string } | null;
  responsable?: { id: string; name: string } | null;
}

export const recentlyOpenedApi = {
  list: (limit = 8) =>
    apiFetch<{ data: RecentlyOpenedItem[] }>(`/documents/recently-opened?limit=${limit}`),
};

// ─── GOOGLE DRIVE ───────────────────────────────────────────────────────

export const driveApi = {
  /** Verifica si Google Drive está conectado y configurado */
  getStatus: () =>
    apiFetch<{ connected: boolean }>('/drive/status'),

  /** Sincroniza un documento al Drive (subida o actualización) */
  syncDocument: (documentId: string, changeNote?: string) =>
    apiFetch<{
      ok: boolean;
      driveFileId: string;
      driveRevisionId: string | null;
      version: number;
      lastSyncAt: string;
    }>(`/drive/sync/${documentId}`, {
      method: 'POST',
      body: JSON.stringify({ changeNote }),
    }),

  /** Descarga versión de Drive y actualiza el archivo local */
  pullDocument: (documentId: string) =>
    apiFetch<{ ok: boolean; localPath: string; lastSyncAt: string }>(
      `/drive/sync/${documentId}`,
    ),

  /** Lista revisiones de un documento en Drive */
  getRevisions: (documentId: string) =>
    apiFetch<{ revisions: any[]; versions: any[] }>(
      `/drive/revisions/${documentId}`,
    ),

  /** Descarga una revisión específica de Drive */
  downloadRevision: async (documentId: string, revisionId: string, fileName?: string) => {
    const token = await getAccessToken();
    const url = `${API_URL}/drive/revisions/${documentId}/${revisionId}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, 'Error al descargar revisión');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName ?? 'revision';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },
};

// ─── BÚSQUEDA GLOBAL ─────────────────────────────────────────────────────────

export type SearchEntityType = 'document' | 'convenio' | 'case';

export interface SearchHit {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  tags?: string[];
  url: string;
  meta?: Record<string, unknown>;
  updatedAt?: string;
  /** Fragmento de título con <mark> resaltado */
  highlight?: string;
  /** Fragmento de contenido del documento con <mark> resaltado (solo Meilisearch) */
  contentSnippet?: string;
  /** Fecha de creación */
  createdAt?: string;
}

export interface SearchResults {
  hits: SearchHit[];
  totalHits: number;
  processingTimeMs: number;
  query: string;
}

export const searchApi = {
  globalSearch: (
    query: string,
    options?: {
      limit?: number;
      types?: SearchEntityType[];
    },
  ): Promise<SearchResults> => {
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.types?.length) params.set('types', options.types.join(','));
    return apiFetch<SearchResults>(`/search?${params.toString()}`);
  },
};

// ─── PDFs ENLAZADOS A DOCUMENTOS ─────────────────────────────────────────────

export interface ApiDocumentPdf {
  id: string;
  documentId: string;
  name: string;
  localPath: string;
  size: number;
  source: 'manual' | 'share';
  createdBy: string | null;
  createdAt: string;
  creator?: { id: string; name: string } | null;
}

/** Construye la URL para servir/previsualizar un PDF convertido (autenticado) */
export function getDocumentPdfFileUrl(documentId: string, pdfId: string): string {
  return `${API_URL}/documents/${documentId}/pdfs/${pdfId}/file`;
}

/** Sube un Blob PDF ya generado al servidor y lo enlaza al documento */
async function uploadPdfBlob(
  documentId: string,
  pdfBlob: Blob,
  source: 'manual' | 'share',
): Promise<ApiDocumentPdf> {
  const token = await (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  })();

  const formData = new FormData();
  formData.append('pdf', pdfBlob, 'document.pdf');
  formData.append('source', source);

  const res = await fetch(`${API_URL}/documents/${documentId}/upload-pdf`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? `Error al subir el PDF (${res.status})`);
  }
  return res.json();
}

/** Genera un PDF fiel desde un elemento DOM con html2canvas+jsPDF y lo sube */
async function generatePdfFromElement(
  element: HTMLElement,
  documentId: string,
  source: 'manual' | 'share',
): Promise<ApiDocumentPdf> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    backgroundColor: '#ffffff',
  });

  const pageWidth = 595.28;   // A4 pt width
  const pageHeight = 841.89; // A4 pt height
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let y = 0;
  let remaining = imgHeight;
  let first = true;
  while (remaining > 0) {
    if (!first) pdf.addPage();
    first = false;
    const srcY = (imgHeight - remaining) / imgHeight * canvas.height;
    const sliceH = Math.min(remaining, pageHeight);
    const sliceCanvasH = sliceH / imgHeight * canvas.height;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceCanvasH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvasH, 0, 0, canvas.width, sliceCanvasH);

    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, sliceH);
    remaining -= pageHeight;
    y += pageHeight;
  }

  const pdfBlob = pdf.output('blob');
  return uploadPdfBlob(documentId, pdfBlob, source);
}

/** Extiende documentsApi con métodos de PDFs enlazados */
export const documentPdfsApi = {
  /**
   * Sube un PDF ya generado (Blob) al servidor y lo enlaza al documento.
   * Usar cuando ya tienes el Blob del PDF listo (e.g. desde SuperDoc export).
   */
  upload: (documentId: string, pdfBlob: Blob, source: 'manual' | 'share' = 'manual') =>
    uploadPdfBlob(documentId, pdfBlob, source),

  /**
   * Genera el PDF desde un elemento DOM visible (html2canvas+jsPDF) y lo sube.
   * Usar cuando quieres capturar lo que el usuario ve en pantalla.
   */
  generateFromElement: (documentId: string, element: HTMLElement, source: 'manual' | 'share' = 'manual') =>
    generatePdfFromElement(element, documentId, source),

  /** Lista todos los PDFs convertidos enlazados al documento */
  list: (documentId: string) =>
    apiFetch<{ pdfs: ApiDocumentPdf[] }>(`/documents/${documentId}/pdfs`),

  /** Elimina un PDF enlazado */
  delete: (documentId: string, pdfId: string) =>
    apiFetch<{ ok: boolean; message: string }>(`/documents/${documentId}/pdfs/${pdfId}`, {
      method: 'DELETE',
    }),

  /** Descarga un PDF autenticado al disco local */
  download: async (documentId: string, pdfId: string, fileName: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;

    const url = getDocumentPdfFileUrl(documentId, pdfId);
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error('Error al descargar el PDF');

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },
};

