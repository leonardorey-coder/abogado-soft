// ============================================================================
// Capa de servicios API — Cliente HTTP centralizado
// Conecta el frontend con el backend Express/Prisma en localhost:4000
// ============================================================================

import { supabase } from './supabaseAuth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

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
  createdAt: string;
  updatedAt: string;
  responsable?: { id: string; name: string; email: string } | null;
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
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    fileStatus?: string;
    groupId?: string;
    caseId?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.fileStatus) query.set('fileStatus', params.fileStatus);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.caseId) query.set('caseId', params.caseId);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiDocument>>(`/documents${qs ? `?${qs}` : ''}`);
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
  listReceived: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiDocumentAssignment>>(`/assignments${qs ? `?${qs}` : ''}`);
  },

  listSent: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiDocumentAssignment>>(`/assignments/sent${qs ? `?${qs}` : ''}`);
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
};

// ─── ACTIVIDAD ──────────────────────────────────────────────────────────

export const activityApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    activity?: string;
    entityType?: string;
    from?: string;
    to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.activity) query.set('activity', params.activity);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return apiFetch<PaginatedResponse<ApiActivityLog>>(`/activity${qs ? `?${qs}` : ''}`);
  },

  stats: () => apiFetch<{
    today: number;
    thisWeek: number;
    topActivities: Array<{ activity: string; _count: { id: number } }>;
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
    return apiFetch<PaginatedResponse<unknown>>(`/backups${qs ? `?${qs}` : ''}`);
  },

  create: (data: { name: string; type?: string }) =>
    apiFetch('/backups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => apiFetch(`/backups/${id}`),
};
