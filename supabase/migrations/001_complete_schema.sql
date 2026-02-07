-- ============================================================================
-- AbogadoSoft — Esquema completo de base de datos PostgreSQL
-- Versión: 1.0
-- Fecha: 7 de febrero de 2026
-- Stack: PostgreSQL 16 + Supabase
-- ============================================================================
-- Orden de creación respetuoso con las dependencias (foreign keys):
--   1. Extensiones
--   2. Tipos ENUM
--   3. Tablas independientes (users)
--   4. Tablas dependientes (groups, documents, convenios, etc.)
--   5. Tablas de relación N:M
--   6. Índices
--   7. Funciones y triggers
--   8. Row Level Security (RLS)
-- ============================================================================

-- ─────────────────────────────────────────────
-- 1. EXTENSIONES
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- gen_random_uuid() ya existe en PG 13+, pero por si acaso
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- para gen_random_uuid() y crypt/hasheo

-- ─────────────────────────────────────────────
-- 2. TIPOS ENUM
-- ─────────────────────────────────────────────

-- Roles de usuario en la aplicación
CREATE TYPE user_role AS ENUM ('admin', 'asistente');
-- admin     = Abogado (acceso completo)
-- asistente = Auxiliar (acceso limitado, puede solicitar acceso completo por sesión)

-- Roles dentro de un grupo
CREATE TYPE group_role AS ENUM ('admin', 'editor', 'viewer');

-- Tipos de archivo soportados
CREATE TYPE document_type AS ENUM ('docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt', 'rtf');

-- Estado de archivo del documento
CREATE TYPE file_status AS ENUM ('ACTIVO', 'PENDIENTE', 'INACTIVO');

-- Estado de colaboración
CREATE TYPE collaboration_status AS ENUM (
  'VISTO',
  'EDITADO',
  'COMENTADO',
  'REVISADO',
  'APROBADO',
  'PENDIENTE_REVISION',
  'RECHAZADO'
);

-- Estado de compartición
CREATE TYPE sharing_status AS ENUM ('ENVIADO', 'ASIGNADO');

-- Nivel de permiso sobre documentos
CREATE TYPE permission_level AS ENUM ('none', 'download', 'read', 'write', 'admin');

-- Estado de convenio
CREATE TYPE convenio_status AS ENUM ('activo', 'pendiente', 'vencido', 'expirado', 'cancelado');
-- UI usa EXPIRADO en AgreementsList; 'vencido' y 'expirado' son equivalentes funcionales

-- Operación de sincronización
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete');

-- Estado de la cola de sincronización
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'completed', 'failed');

-- Tipo de entidad sincronizable
CREATE TYPE sync_entity_type AS ENUM ('document', 'convenio', 'group', 'user', 'comment');

-- Estado de respaldo
CREATE TYPE backup_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Tipo de actividad para bitácora
CREATE TYPE activity_type AS ENUM (
  'LOGIN',
  'LOGOUT',
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
  'DOCUMENT_DELETED',
  'DOCUMENT_RESTORED',
  'DOCUMENT_SHARED',
  'DOCUMENT_ASSIGNED',
  'DOCUMENT_DOWNLOADED',
  'DOCUMENT_EXTRACTED',
  'DOCUMENT_PERMISSION_CHANGED',
  'DOCUMENT_VERSION_CREATED',
  'DOCUMENT_COMMENT_ADDED',
  'DOCUMENT_COMMENT_DELETED',
  'CONVENIO_CREATED',
  'CONVENIO_UPDATED',
  'CONVENIO_DELETED',
  'GROUP_CREATED',
  'GROUP_UPDATED',
  'GROUP_DELETED',
  'GROUP_MEMBER_ADDED',
  'GROUP_MEMBER_REMOVED',
  'ADMIN_ACCESS_GRANTED',
  'ADMIN_ACCESS_DENIED',
  'BACKUP_CREATED',
  'BACKUP_RESTORED',
  'USER_REGISTERED',
  'USER_UPDATED',
  'PASSWORD_CHANGED',
  'SETTINGS_CHANGED',
  'COLLABORATION_STARTED',
  'COLLABORATION_ENDED',
  'DOCUMENT_LOCKED',
  'DOCUMENT_UNLOCKED',
  'CASE_CREATED',
  'CASE_UPDATED',
  'CASE_DOCUMENT_LINKED',
  'CASE_DOCUMENT_UNLINKED'
);


-- ─────────────────────────────────────────────
-- 3. TABLA DE USUARIOS
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),                          -- hash bcrypt; en Supabase se gestiona por auth
  role          user_role NOT NULL DEFAULT 'asistente', -- admin = abogado, asistente = auxiliar
  avatar_url    TEXT,
  phone         VARCHAR(50),
  office_name   VARCHAR(255),                          -- nombre de despacho / firma (RegisterPage)
  department    VARCHAR(255),                          -- departamento / facultad
  position      VARCHAR(255),                          -- cargo
  admin_pin_hash VARCHAR(255),                         -- hash del PIN de admin (para AdminAccessModal)
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users IS 'Usuarios del sistema. role=admin es abogado, role=asistente es auxiliar.';
COMMENT ON COLUMN users.role IS 'admin = abogado (acceso completo), asistente = auxiliar (acceso restringido).';
COMMENT ON COLUMN users.office_name IS 'Nombre del despacho/firma legal (campo de registro).';
COMMENT ON COLUMN users.admin_pin_hash IS 'Hash del PIN para conceder acceso completo temporal a auxiliares (AdminAccessModal).';


-- ─────────────────────────────────────────────
-- 4. GRUPOS DE TRABAJO
-- ─────────────────────────────────────────────
CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  invite_code   VARCHAR(64) UNIQUE,                    -- código de invitación al grupo
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE groups IS 'Grupos de trabajo para colaboración entre usuarios.';


-- ─────────────────────────────────────────────
-- 5. MIEMBROS DE GRUPO
-- ─────────────────────────────────────────────
CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       group_role NOT NULL DEFAULT 'viewer',     -- admin, editor, viewer
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

COMMENT ON TABLE group_members IS 'Relación usuarios ↔ grupos con rol dentro del grupo.';


-- ─────────────────────────────────────────────
-- 6. DOCUMENTOS
-- ─────────────────────────────────────────────
CREATE TABLE documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(500) NOT NULL,
  type                  document_type NOT NULL,
  size                  BIGINT NOT NULL DEFAULT 0,       -- bytes
  local_path            TEXT,                             -- ruta en disco local
  cloud_url             TEXT,                             -- URL en Supabase Storage
  owner_id              UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id              UUID REFERENCES groups(id) ON DELETE SET NULL,
  case_id               UUID,                            -- expediente vinculado (FK se agrega después de crear tabla cases)

  -- Estados del documento (PRD §3.1)
  file_status           file_status NOT NULL DEFAULT 'ACTIVO',
  collaboration_status  collaboration_status,
  sharing_status        sharing_status,

  -- Versionado
  version               INTEGER NOT NULL DEFAULT 1,
  checksum              VARCHAR(128),                    -- SHA-256

  -- Fechas de control
  expiration_date       DATE,                            -- fecha de vencimiento, alerta visual

  -- Soft-delete → papelera con recuperación 30 días
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metadatos
  description           TEXT,
  tags                  TEXT[],                           -- etiquetas de búsqueda
  mime_type             VARCHAR(255),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  documents IS 'Documentos gestionados. Soporta soft-delete (papelera 30 días).';
COMMENT ON COLUMN documents.file_status IS 'ACTIVO | PENDIENTE | INACTIVO';
COMMENT ON COLUMN documents.collaboration_status IS 'VISTO | EDITADO | COMENTADO | REVISADO | APROBADO | PENDIENTE_REVISION | RECHAZADO';
COMMENT ON COLUMN documents.sharing_status IS 'ENVIADO (compartido por enlace) | ASIGNADO (asignado a usuario específico)';


-- ─────────────────────────────────────────────
-- 7. PERMISOS SOBRE DOCUMENTOS
-- ─────────────────────────────────────────────
CREATE TABLE document_permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id         UUID REFERENCES groups(id) ON DELETE CASCADE,
  permission_level permission_level NOT NULL DEFAULT 'read',  -- none | download | read | write | admin
  granted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ,                               -- permiso temporal (ej. acceso completo por sesión)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Al menos un destinatario (usuario o grupo)
  CONSTRAINT chk_permission_target CHECK (user_id IS NOT NULL OR group_id IS NOT NULL),
  -- Un usuario solo tiene un registro de permiso por documento
  CONSTRAINT uq_doc_user_perm UNIQUE (document_id, user_id),
  -- Un grupo solo tiene un registro de permiso por documento
  CONSTRAINT uq_doc_group_perm UNIQUE (document_id, group_id)
);

COMMENT ON TABLE document_permissions IS 'Permisos granulares por documento: none, download, read, write, admin.';


-- ─────────────────────────────────────────────
-- 8. DOCUMENTOS ASIGNADOS
-- ─────────────────────────────────────────────
CREATE TABLE document_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  assigned_to   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(50) NOT NULL DEFAULT 'pendiente'
                CHECK (status IN ('pendiente', 'visto', 'revisado', 'completado', 'rechazado')),
  notes         TEXT,
  due_date      DATE,                                  -- fecha límite
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_doc_assignment UNIQUE (document_id, assigned_to)
);

COMMENT ON TABLE document_assignments IS 'Documentos asignados de un usuario a otro. Vista en "Asignados".';


-- ─────────────────────────────────────────────
-- 9. HISTORIAL DE VERSIONES DE DOCUMENTOS
-- ─────────────────────────────────────────────
CREATE TABLE document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  local_path    TEXT,
  cloud_url     TEXT,
  size          BIGINT NOT NULL DEFAULT 0,
  checksum      VARCHAR(128),
  change_note   TEXT,                                  -- nota de cambio / descripción
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_doc_version UNIQUE (document_id, version)
);

COMMENT ON TABLE document_versions IS 'Historial de versiones. Se conservan las últimas 10 versiones por documento (PRD §3.2).';


-- ─────────────────────────────────────────────
-- 10. COMENTARIOS EN DOCUMENTOS
-- ─────────────────────────────────────────────
CREATE TABLE document_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES document_comments(id) ON DELETE CASCADE,  -- respuestas (hilo)
  content       TEXT NOT NULL,
  page_number   INTEGER,                               -- página del documento (para PDFs)
  position_x    REAL,                                  -- coordenada X de anotación
  position_y    REAL,                                  -- coordenada Y de anotación
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE document_comments IS 'Comentarios y anotaciones por documento. Soporta hilos (parent_id).';


-- ─────────────────────────────────────────────
-- 11. BITÁCORA / LOG DE ACTIVIDAD
-- ─────────────────────────────────────────────
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  activity      activity_type NOT NULL,
  entity_type   VARCHAR(50),                           -- 'document', 'convenio', 'group', 'user', etc.
  entity_id     UUID,                                  -- ID de la entidad afectada
  entity_name   VARCHAR(500),                          -- nombre legible (ej. nombre del documento)
  description   TEXT,                                  -- descripción en lenguaje natural
  metadata      JSONB,                                 -- datos adicionales (IP, user agent, cambios, etc.)
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE activity_log IS 'Bitácora de auditoría. Registra todas las acciones relevantes del sistema.';


-- ─────────────────────────────────────────────
-- 12. CONVENIOS UNIVERSIDAD-ABOGADOS
-- ─────────────────────────────────────────────
CREATE TABLE convenios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          VARCHAR(100) UNIQUE NOT NULL,          -- identificador único del convenio
  institucion     VARCHAR(255) NOT NULL,                 -- universidad / entidad
  departamento    VARCHAR(255),                          -- departamento / facultad
  descripcion     TEXT,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  responsable_id  UUID REFERENCES users(id) ON DELETE SET NULL,  -- abogado responsable
  estado          convenio_status NOT NULL DEFAULT 'pendiente',
  notas           TEXT,
  monto           NUMERIC(14,2),                         -- monto del convenio (si aplica)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_fechas_convenio CHECK (fecha_fin >= fecha_inicio)
);

COMMENT ON TABLE convenios IS 'Convenios universidad-abogados. Estados: activo, pendiente, vencido, cancelado.';


-- ─────────────────────────────────────────────
-- 13. DOCUMENTOS DE CONVENIOS (N:M)
-- ─────────────────────────────────────────────
CREATE TABLE convenio_documents (
  convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (convenio_id, document_id)
);

COMMENT ON TABLE convenio_documents IS 'Relación N:M entre convenios y documentos adjuntos.';


-- ─────────────────────────────────────────────
-- 14. RESPALDOS / BACKUPS
-- ─────────────────────────────────────────────
CREATE TABLE backups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(500) NOT NULL,                 -- nombre descriptivo del respaldo
  type            VARCHAR(50) NOT NULL DEFAULT 'full'
                  CHECK (type IN ('full', 'incremental', 'documents_only', 'database_only')),
  status          backup_status NOT NULL DEFAULT 'pending',
  file_path       TEXT,                                  -- ruta del archivo de respaldo
  cloud_url       TEXT,                                  -- URL en nube (si se respalda remotamente)
  size            BIGINT,                                -- tamaño en bytes
  checksum        VARCHAR(128),
  documents_count INTEGER DEFAULT 0,                     -- cantidad de documentos respaldados
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB,                                 -- información adicional
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE backups IS 'Registro de respaldos del sistema. Backup automático diario (PRD §9).';


-- ─────────────────────────────────────────────
-- 15. LOG DE ACCESO COMPLETO (ADMIN TEMPORAL)
-- ─────────────────────────────────────────────
CREATE TABLE admin_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted         BOOLEAN NOT NULL DEFAULT FALSE,        -- TRUE=aprobado, FALSE=denegado
  session_token   VARCHAR(255),                          -- token de sesión donde se concedió
  ip_address      INET,
  expires_at      TIMESTAMPTZ,                           -- cuándo expira el acceso temporal
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_access_log IS 'Registro de solicitudes de acceso completo (auxiliar → admin temporal sobre documento). PRD §3.1.';


-- ─────────────────────────────────────────────
-- 16. EXPEDIENTES / CASOS LEGALES
-- ─────────────────────────────────────────────
-- DocumentEditor muestra "Detalles del Caso" y ExcelEditor vincula con expedientes.
CREATE TABLE cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number     VARCHAR(100) UNIQUE NOT NULL,          -- ej. "2023-084", "EXP-2024-001"
  title           VARCHAR(500) NOT NULL,                 -- ej. "Demanda Civil - Pérez vs. García"
  client          VARCHAR(255),                          -- cliente principal
  court           VARCHAR(255),                          -- juzgado / instancia
  case_type       VARCHAR(100),                          -- ej. "Civil / Contractual", "Laboral"
  status          VARCHAR(50) NOT NULL DEFAULT 'en_proceso'
                  CHECK (status IN ('en_proceso', 'resuelto', 'archivado', 'apelacion', 'pendiente')),
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  responsible_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cases IS 'Expedientes/casos legales. Vinculados a documentos y convenios. UI: DocumentEditor > Detalles del Caso, ExcelEditor > Vincular a Expediente.';

-- Relación N:M expedientes ↔ documentos
CREATE TABLE case_documents (
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (case_id, document_id)
);

COMMENT ON TABLE case_documents IS 'Relación N:M entre expedientes y documentos. ExcelEditor permite vincular docs a expedientes.';

-- FK diferida: documents.case_id → cases.id (la tabla cases se crea despues)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_case
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;

CREATE INDEX idx_docs_case ON documents(case_id) WHERE case_id IS NOT NULL;


-- ─────────────────────────────────────────────
-- 17. COLABORACIÓN EN TIEMPO REAL (Google Docs-like)
-- ─────────────────────────────────────────────

-- Sesiones de edición colaborativa activas
CREATE TABLE collaboration_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  CONSTRAINT uq_active_session UNIQUE (document_id)  -- un documento solo tiene una sesión activa
);

COMMENT ON TABLE collaboration_sessions IS 'Sesión de edición colaborativa en tiempo real. Un documento tiene una sola sesión activa a la vez.';

-- Presencia de usuarios en una sesión (quién está editando)
CREATE TABLE collaboration_presence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cursor_position JSONB,                               -- {line, column, selection_start, selection_end}
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at         TIMESTAMPTZ,
  CONSTRAINT uq_session_user UNIQUE (session_id, user_id)
);

COMMENT ON TABLE collaboration_presence IS 'Presencia de usuarios editando un documento. Cursor position se actualiza con Supabase Realtime.';

-- Operaciones del documento (log de cambios en tiempo real — OT/CRDT)
CREATE TABLE collaboration_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type  VARCHAR(50) NOT NULL
                  CHECK (operation_type IN ('insert', 'delete', 'replace', 'format', 'cursor_move')),
  position        INTEGER,                             -- offset en el documento
  length          INTEGER,                             -- longitud afectada
  content         TEXT,                                -- texto insertado / de formato
  metadata        JSONB,                               -- datos adicionales (formato, atributos)
  revision        BIGINT NOT NULL,                     -- número de revisión secuencial
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE collaboration_operations IS 'Log de operaciones de escritura para edición colaborativa (OT). Se emite vía Supabase Realtime a todos los clientes.';

-- Bloqueo de secciones del documento (evitar conflictos)
CREATE TABLE document_locks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id    VARCHAR(255),                          -- identificador de sección/párrafo bloqueado (null = doc entero)
  lock_type     VARCHAR(20) NOT NULL DEFAULT 'section'
                CHECK (lock_type IN ('document', 'section', 'paragraph')),
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),  -- auto-release
  released_at   TIMESTAMPTZ,
  CONSTRAINT uq_doc_section_lock UNIQUE (document_id, section_id)
);

COMMENT ON TABLE document_locks IS 'Bloqueo temporal de secciones para evitar conflictos de escritura. Expira automáticamente.';


-- ─────────────────────────────────────────────
-- 18. COLA DE SINCRONIZACIÓN
-- ─────────────────────────────────────────────
CREATE TABLE sync_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   sync_entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  operation     sync_operation NOT NULL,                 -- create | update | delete
  payload       JSONB,
  status        sync_status NOT NULL DEFAULT 'pending',
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 5,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at     TIMESTAMPTZ
);

COMMENT ON TABLE sync_queue IS 'Cola de sincronización local ↔ nube. Se procesa cada 30 segundos.';


-- ─────────────────────────────────────────────
-- 19. CONFIGURACIÓN DE USUARIO (PREFERENCIAS)
-- ─────────────────────────────────────────────
CREATE TABLE user_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme            VARCHAR(20) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'high_contrast')),
  font_size        INTEGER NOT NULL DEFAULT 16 CHECK (font_size BETWEEN 12 AND 32),
  notifications    BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save        BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save_interval INTEGER NOT NULL DEFAULT 30,       -- segundos
  language         VARCHAR(10) NOT NULL DEFAULT 'es',
  storage_path     TEXT,                                -- ruta personalizada de almacenamiento
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_settings IS 'Preferencias de usuario: tema, tamaño de fuente, auto-guardado, etc.';


-- ─────────────────────────────────────────────
-- 20. SESIONES ACTIVAS
-- ─────────────────────────────────────────────
CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(512) UNIQUE NOT NULL,
  device_info   JSONB,                                 -- SO, nombre de equipo, etc.
  ip_address    INET,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuario para control de accesos y expiración.';


-- ─────────────────────────────────────────────
-- 21. NOTIFICACIONES
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  message       TEXT NOT NULL,
  type          VARCHAR(50) NOT NULL DEFAULT 'info'
                CHECK (type IN ('info', 'warning', 'error', 'success', 'assignment', 'share', 'expiration')),
  entity_type   VARCHAR(50),                            -- 'document', 'convenio', etc.
  entity_id     UUID,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Notificaciones para usuarios: asignaciones, compartidos, vencimientos, etc.';


-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Users
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_role      ON users(role);
CREATE INDEX idx_users_active    ON users(is_active);

-- Groups
CREATE INDEX idx_groups_owner    ON groups(owner_id);

-- Group members
CREATE INDEX idx_gm_group        ON group_members(group_id);
CREATE INDEX idx_gm_user         ON group_members(user_id);

-- Documents
CREATE INDEX idx_docs_owner      ON documents(owner_id);
CREATE INDEX idx_docs_group      ON documents(group_id);
CREATE INDEX idx_docs_deleted    ON documents(is_deleted);
CREATE INDEX idx_docs_file_stat  ON documents(file_status);
CREATE INDEX idx_docs_collab_stat ON documents(collaboration_status);
CREATE INDEX idx_docs_sharing    ON documents(sharing_status);
CREATE INDEX idx_docs_type       ON documents(type);
CREATE INDEX idx_docs_updated    ON documents(updated_at DESC);
CREATE INDEX idx_docs_expiration ON documents(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_docs_name_trgm  ON documents USING gin (name gin_trgm_ops);  -- búsqueda por nombre (requiere pg_trgm)

-- Document permissions
CREATE INDEX idx_dperm_doc       ON document_permissions(document_id);
CREATE INDEX idx_dperm_user      ON document_permissions(user_id);
CREATE INDEX idx_dperm_group     ON document_permissions(group_id);
CREATE INDEX idx_dperm_level     ON document_permissions(permission_level);

-- Document assignments
CREATE INDEX idx_dassign_to      ON document_assignments(assigned_to);
CREATE INDEX idx_dassign_by      ON document_assignments(assigned_by);
CREATE INDEX idx_dassign_status  ON document_assignments(status);
CREATE INDEX idx_dassign_doc     ON document_assignments(document_id);

-- Document versions
CREATE INDEX idx_dver_doc        ON document_versions(document_id);
CREATE INDEX idx_dver_created_by ON document_versions(created_by);

-- Document comments
CREATE INDEX idx_dcom_doc        ON document_comments(document_id);
CREATE INDEX idx_dcom_user       ON document_comments(user_id);
CREATE INDEX idx_dcom_parent     ON document_comments(parent_id);

-- Activity log
CREATE INDEX idx_alog_user       ON activity_log(user_id);
CREATE INDEX idx_alog_activity   ON activity_log(activity);
CREATE INDEX idx_alog_entity     ON activity_log(entity_type, entity_id);
CREATE INDEX idx_alog_created    ON activity_log(created_at DESC);

-- Convenios
CREATE INDEX idx_conv_estado     ON convenios(estado);
CREATE INDEX idx_conv_fecha_fin  ON convenios(fecha_fin);
CREATE INDEX idx_conv_responsable ON convenios(responsable_id);
CREATE INDEX idx_conv_institucion ON convenios(institucion);

-- Sync queue
CREATE INDEX idx_sync_status     ON sync_queue(status);
CREATE INDEX idx_sync_entity     ON sync_queue(entity_type, entity_id);
CREATE INDEX idx_sync_created    ON sync_queue(created_at);

-- Backups
CREATE INDEX idx_backup_status   ON backups(status);
CREATE INDEX idx_backup_created  ON backups(created_at DESC);

-- Cases / Expedientes
CREATE INDEX idx_cases_number      ON cases(case_number);
CREATE INDEX idx_cases_status      ON cases(status);
CREATE INDEX idx_cases_responsible ON cases(responsible_id);
CREATE INDEX idx_cases_type        ON cases(case_type);
CREATE INDEX idx_case_docs_case    ON case_documents(case_id);
CREATE INDEX idx_case_docs_doc     ON case_documents(document_id);

-- Collaboration
CREATE INDEX idx_collab_sess_doc      ON collaboration_sessions(document_id);
CREATE INDEX idx_collab_sess_active   ON collaboration_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_collab_pres_session  ON collaboration_presence(session_id);
CREATE INDEX idx_collab_pres_user     ON collaboration_presence(user_id);
CREATE INDEX idx_collab_pres_active   ON collaboration_presence(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_collab_ops_session   ON collaboration_operations(session_id);
CREATE INDEX idx_collab_ops_revision  ON collaboration_operations(session_id, revision);
CREATE INDEX idx_collab_ops_created   ON collaboration_operations(created_at);
CREATE INDEX idx_doc_locks_doc        ON document_locks(document_id);
CREATE INDEX idx_doc_locks_expires    ON document_locks(expires_at) WHERE released_at IS NULL;

-- Admin access log
CREATE INDEX idx_aal_doc         ON admin_access_log(document_id);
CREATE INDEX idx_aal_user        ON admin_access_log(user_id);
CREATE INDEX idx_aal_created     ON admin_access_log(created_at DESC);

-- Sessions
CREATE INDEX idx_sess_user       ON user_sessions(user_id);
CREATE INDEX idx_sess_active     ON user_sessions(is_active, expires_at);
CREATE INDEX idx_sess_token      ON user_sessions(session_token);

-- Notifications
CREATE INDEX idx_notif_user      ON notifications(user_id);
CREATE INDEX idx_notif_read      ON notifications(user_id, is_read);
CREATE INDEX idx_notif_type      ON notifications(type);
CREATE INDEX idx_notif_created   ON notifications(created_at DESC);

-- User settings
CREATE INDEX idx_usettings_user  ON user_settings(user_id);


-- ============================================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================================

-- Función genérica para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_doc_permissions_updated_at
  BEFORE UPDATE ON document_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_doc_assignments_updated_at
  BEFORE UPDATE ON document_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_doc_comments_updated_at
  BEFORE UPDATE ON document_comments
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_convenios_updated_at
  BEFORE UPDATE ON convenios
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();


-- ──────────────────────────────────────────────────
-- Función: purgar papelera automáticamente (30 días)
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_purge_trash()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM documents
  WHERE is_deleted = TRUE
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_purge_trash IS 'Elimina permanentemente documentos en papelera con más de 30 días.';


-- ────────────────────────────────────────────────────────────
-- Función: actualizar estado de convenios vencidos
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_convenios_vencidos()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE convenios
  SET estado = 'vencido', updated_at = NOW()
  WHERE estado IN ('activo', 'pendiente')
    AND fecha_fin < CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_update_convenios_vencidos IS 'Marca como vencidos los convenios cuya fecha_fin ya pasó.';


-- ────────────────────────────────────────────────────────────
-- Función: limitar historial a 10 versiones por documento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_limit_document_versions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM document_versions
  WHERE document_id = NEW.document_id
    AND id NOT IN (
      SELECT id FROM document_versions
      WHERE document_id = NEW.document_id
      ORDER BY version DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_limit_versions
  AFTER INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION fn_limit_document_versions();

COMMENT ON FUNCTION fn_limit_document_versions IS 'Conserva solo las últimas 10 versiones por documento (PRD §3.2).';


-- ============================================================================
-- ROW LEVEL SECURITY (para Supabase)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenio_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- ── Users ──
CREATE POLICY "Users: ver propio perfil"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users: ver otros usuarios (para compartir/asignar)"
  ON users FOR SELECT
  USING (TRUE);  -- todos los usuarios autenticados pueden ver la lista

CREATE POLICY "Users: actualizar propio perfil"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ── Documents ──
CREATE POLICY "Docs: ver propios"
  ON documents FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Docs: ver por permiso directo"
  ON documents FOR SELECT
  USING (
    id IN (
      SELECT document_id FROM document_permissions
      WHERE user_id = auth.uid()
        AND permission_level != 'none'
    )
  );

CREATE POLICY "Docs: ver por grupo"
  ON documents FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Docs: crear propios"
  ON documents FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Docs: actualizar propios"
  ON documents FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Docs: actualizar por permiso write/admin"
  ON documents FOR UPDATE
  USING (
    id IN (
      SELECT document_id FROM document_permissions
      WHERE user_id = auth.uid()
        AND permission_level IN ('write', 'admin')
    )
  );

CREATE POLICY "Docs: eliminar propios"
  ON documents FOR DELETE
  USING (owner_id = auth.uid());

-- ── Document permissions ──
CREATE POLICY "DocPerms: ver permisos de documentos accesibles"
  ON document_permissions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "DocPerms: gestionar permisos de documentos propios"
  ON document_permissions FOR ALL
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
    )
  );

-- ── Assignments ──
CREATE POLICY "Assignments: ver asignados al usuario"
  ON document_assignments FOR SELECT
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

CREATE POLICY "Assignments: crear asignaciones"
  ON document_assignments FOR INSERT
  WITH CHECK (assigned_by = auth.uid());

-- ── Comments ──
CREATE POLICY "Comments: ver comentarios de documentos accesibles"
  ON document_comments FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
      UNION
      SELECT document_id FROM document_permissions
      WHERE user_id = auth.uid() AND permission_level != 'none'
    )
  );

CREATE POLICY "Comments: crear comentarios"
  ON document_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Comments: editar propios comentarios"
  ON document_comments FOR UPDATE
  USING (user_id = auth.uid());

-- ── Activity log ──
CREATE POLICY "ALog: admins ven todo, usuarios ven propio"
  ON activity_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Notifications ──
CREATE POLICY "Notif: ver propias"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Notif: actualizar propias (marcar leída)"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ── User settings ──
CREATE POLICY "Settings: ver propias"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Settings: gestionar propias"
  ON user_settings FOR ALL
  USING (user_id = auth.uid());

-- ── Sessions ──
CREATE POLICY "Sessions: ver propias"
  ON user_sessions FOR SELECT
  USING (user_id = auth.uid());

-- ── Groups ──
CREATE POLICY "Groups: ver grupos del usuario"
  ON groups FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Groups: crear"
  ON groups FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Groups: actualizar propios"
  ON groups FOR UPDATE
  USING (owner_id = auth.uid());

-- ── Group members ──
CREATE POLICY "GMembers: ver miembros de mis grupos"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- ── Convenios ──
CREATE POLICY "Convenios: admins ven todo"
  ON convenios FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR responsable_id = auth.uid()
  );

CREATE POLICY "Convenios: admins gestionan"
  ON convenios FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Backups ──
CREATE POLICY "Backups: solo admins"
  ON backups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Cases ──
ALTER TABLE cases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cases: admins ven todo"
  ON cases FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR responsible_id = auth.uid()
  );

CREATE POLICY "Cases: admins gestionan"
  ON cases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "CaseDocs: ver documentos de caso accesible"
  ON case_documents FOR SELECT
  USING (
    case_id IN (SELECT id FROM cases WHERE responsible_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Collaboration (Realtime) ──
ALTER TABLE collaboration_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_presence    ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_operations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_locks            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CollabSessions: participantes ven"
  ON collaboration_sessions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
      UNION
      SELECT document_id FROM document_permissions
      WHERE user_id = auth.uid() AND permission_level IN ('read', 'write', 'admin')
    )
  );

CREATE POLICY "CollabPresence: ver presencia de sesión accesible"
  ON collaboration_presence FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM collaboration_sessions cs
      WHERE cs.document_id IN (
        SELECT id FROM documents WHERE owner_id = auth.uid()
        UNION
        SELECT document_id FROM document_permissions
        WHERE user_id = auth.uid() AND permission_level IN ('read', 'write', 'admin')
      )
    )
  );

CREATE POLICY "CollabPresence: gestionar propia"
  ON collaboration_presence FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "CollabOps: ver operaciones de sesión accesible"
  ON collaboration_operations FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM collaboration_sessions cs
      WHERE cs.document_id IN (
        SELECT id FROM documents WHERE owner_id = auth.uid()
        UNION
        SELECT document_id FROM document_permissions
        WHERE user_id = auth.uid() AND permission_level IN ('read', 'write', 'admin')
      )
    )
  );

CREATE POLICY "CollabOps: insertar propias operaciones"
  ON collaboration_operations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "DocLocks: ver locks de docs accesibles"
  ON document_locks FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE owner_id = auth.uid()
      UNION
      SELECT document_id FROM document_permissions
      WHERE user_id = auth.uid() AND permission_level IN ('read', 'write', 'admin')
    )
  );

CREATE POLICY "DocLocks: gestionar propios locks"
  ON document_locks FOR ALL
  USING (user_id = auth.uid());


-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar usuario admin de prueba (contraseña: se gestiona desde Supabase Auth)
-- INSERT INTO users (email, name, role, department, position)
-- VALUES ('admin@universidad.edu.mx', 'Lic. García López', 'admin', 'Oficina Jurídica', 'Abogado General');

-- INSERT INTO users (email, name, role, department, position)
-- VALUES ('asistente@universidad.edu.mx', 'María López Hernández', 'asistente', 'Oficina Jurídica', 'Auxiliar');


-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista: documentos con permisos del usuario
CREATE OR REPLACE VIEW v_documents_with_permissions AS
SELECT
  d.*,
  dp.permission_level AS current_user_permission,
  dp.user_id          AS permission_user_id,
  u.name              AS owner_name
FROM documents d
LEFT JOIN document_permissions dp ON d.id = dp.document_id
LEFT JOIN users u ON d.owner_id = u.id
WHERE d.is_deleted = FALSE;

COMMENT ON VIEW v_documents_with_permissions IS 'Documentos activos con información de permisos y propietario.';


-- Vista: documentos asignados con detalle
CREATE OR REPLACE VIEW v_assigned_documents AS
SELECT
  da.id                AS assignment_id,
  da.status            AS assignment_status,
  da.notes             AS assignment_notes,
  da.due_date,
  da.created_at        AS assigned_at,
  d.id                 AS document_id,
  d.name               AS document_name,
  d.type               AS document_type,
  d.file_status,
  d.collaboration_status,
  d.expiration_date,
  d.updated_at         AS last_modified,
  assigner.name        AS assigned_by_name,
  assignee.name        AS assigned_to_name,
  da.assigned_to,
  da.assigned_by
FROM document_assignments da
JOIN documents d        ON da.document_id = d.id
JOIN users assigner     ON da.assigned_by = assigner.id
JOIN users assignee     ON da.assigned_to = assignee.id
WHERE d.is_deleted = FALSE;

COMMENT ON VIEW v_assigned_documents IS 'Vista para la página "Asignados": documentos asignados con detalle.';


-- Vista: convenios con estado actualizado y alerta de vencimiento
CREATE OR REPLACE VIEW v_convenios_dashboard AS
SELECT
  c.*,
  u.name AS responsable_name,
  CASE
    WHEN c.fecha_fin < CURRENT_DATE THEN 'vencido'
    WHEN c.fecha_fin <= CURRENT_DATE + INTERVAL '30 days' THEN 'por_vencer'
    ELSE c.estado::TEXT
  END AS estado_display,
  (c.fecha_fin - CURRENT_DATE) AS dias_restantes,
  (SELECT COUNT(*) FROM convenio_documents cd WHERE cd.convenio_id = c.id) AS total_documentos
FROM convenios c
LEFT JOIN users u ON c.responsable_id = u.id;

COMMENT ON VIEW v_convenios_dashboard IS 'Vista para el módulo de convenios con alertas de vencimiento.';


-- Vista: resumen de actividad reciente
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
  al.id,
  al.activity,
  al.entity_type,
  al.entity_id,
  al.entity_name,
  al.description,
  al.created_at,
  u.name     AS user_name,
  u.email    AS user_email,
  u.role     AS user_role
FROM activity_log al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

COMMENT ON VIEW v_recent_activity IS 'Vista para la página de Bitácora con datos del usuario.';


-- Vista: caso/expediente con documentos vinculados
CREATE OR REPLACE VIEW v_case_details AS
SELECT
  c.id              AS case_id,
  c.case_number,
  c.title,
  c.client,
  c.court,
  c.case_type,
  c.status,
  c.description,
  c.start_date,
  c.end_date,
  c.created_at,
  u.name            AS responsible_name,
  (SELECT COUNT(*) FROM case_documents cd WHERE cd.case_id = c.id) AS total_documents
FROM cases c
LEFT JOIN users u ON c.responsible_id = u.id;

COMMENT ON VIEW v_case_details IS 'Vista para "Detalles del Caso" en DocumentEditor y vinculación en ExcelEditor.';


-- Vista: presencia activa de colaboración (quién está editando qué)
CREATE OR REPLACE VIEW v_active_collaborators AS
SELECT
  cs.document_id,
  d.name            AS document_name,
  cp.user_id,
  u.name            AS user_name,
  u.avatar_url,
  cp.cursor_position,
  cp.last_seen,
  cp.joined_at
FROM collaboration_presence cp
JOIN collaboration_sessions cs ON cp.session_id = cs.id
JOIN documents d ON cs.document_id = d.id
JOIN users u ON cp.user_id = u.id
WHERE cp.is_active = TRUE
  AND cs.is_active = TRUE;

COMMENT ON VIEW v_active_collaborators IS 'Vista para mostrar avatares/cursores de usuarios editando un documento en tiempo real.';


-- Vista: documentos con bloqueos activos
CREATE OR REPLACE VIEW v_document_locks AS
SELECT
  dl.document_id,
  d.name            AS document_name,
  dl.section_id,
  dl.lock_type,
  dl.user_id,
  u.name            AS locked_by_name,
  dl.locked_at,
  dl.expires_at,
  CASE WHEN dl.expires_at < NOW() THEN TRUE ELSE FALSE END AS is_expired
FROM document_locks dl
JOIN documents d ON dl.document_id = d.id
JOIN users u ON dl.user_id = u.id
WHERE dl.released_at IS NULL;

COMMENT ON VIEW v_document_locks IS 'Vista de bloqueos activos para evitar conflictos de escritura colaborativa.';


-- ============================================================================
-- FUNCIONES PARA COLABORACIÓN EN TIEMPO REAL
-- ============================================================================

-- Función: liberar locks expirados automáticamente
CREATE OR REPLACE FUNCTION fn_release_expired_locks()
RETURNS INTEGER AS $$
DECLARE
  released_count INTEGER;
BEGIN
  UPDATE document_locks
  SET released_at = NOW()
  WHERE released_at IS NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_release_expired_locks IS 'Libera bloqueos de sección expirados (default 5 min).';


-- Función: limpiar presencia inactiva (usuarios que no emiten heartbeat en 2 min)
CREATE OR REPLACE FUNCTION fn_cleanup_stale_presence()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE collaboration_presence
  SET is_active = FALSE, left_at = NOW()
  WHERE is_active = TRUE
    AND last_seen < NOW() - INTERVAL '2 minutes';
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  -- Cerrar sesiones sin participantes activos
  UPDATE collaboration_sessions
  SET is_active = FALSE, ended_at = NOW()
  WHERE is_active = TRUE
    AND id NOT IN (
      SELECT session_id FROM collaboration_presence WHERE is_active = TRUE
    );

  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_cleanup_stale_presence IS 'Marca como inactivos a usuarios sin heartbeat en 2 min y cierra sesiones vacías.';


-- ============================================================================
-- CONFIGURACIÓN SUPABASE REALTIME
-- ============================================================================
-- Las siguientes tablas deben habilitarse para Supabase Realtime:
--   ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_presence;
--   ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_operations;
--   ALTER PUBLICATION supabase_realtime ADD TABLE document_locks;
--   ALTER PUBLICATION supabase_realtime ADD TABLE document_comments;
--   ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- Esto permite que los clientes reciban cambios en tiempo real vía WebSocket.


-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================
