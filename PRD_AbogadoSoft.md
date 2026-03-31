# PRD: AbogadoSoft — Sistema de Gestión Documental para Abogados Universitarios

> **Versión:** 3.0 (Estado actual del producto)
> **Fecha de última actualización:** 31 de marzo de 2026
> **Plataforma primaria:** Web App (Vite + React) con soporte para envoltorio Electron (Desktop)
> **Nombre interno del paquete:** `sidoc`

---

## 1. Resumen Ejecutivo

**AbogadoSoft** es una plataforma web de gestión documental y colaboración diseñada específicamente para el departamento jurídico de una universidad. Permite a abogados y personal administrativo gestionar documentos, convenios institucionales, expedientes legales y equipos de trabajo, desde una interfaz web moderna accesible desde cualquier navegador, con soporte opcional para instalación como app de escritorio vía Electron.

El sistema opera bajo una arquitectura **monorepo** con frontend React/Vite y un backend REST independiente construido sobre Bun + Express, conectado a una base de datos PostgreSQL alojada en Supabase. La autenticación la provee Supabase Auth; el ORM que mapea los datos es Prisma 7.

### Estado del Producto

El software está **en producción activa**. Todas las funcionalidades descritas en este documento están implementadas y operativas. El prototipo inicial (elección de tecnología, UI, modelo de datos) ha evolucionado hacia un sistema completo en uso.

---

## 2. Usuarios Objetivo

| Perfil | Rol en el sistema | Necesidades clave |
|--------|-------------------|-------------------|
| **Abogado / Titular** | `admin` | CRUD completo, gestión de equipo, convenios, backups, seguridad |
| **Auxiliar / Asistente** | `asistente` | Acceso a documentos asignados, edición limitada, visualización de bitácora |
| **Administrador de TI** | Acceso Supabase/DB directo | Mantenimiento, migraciones, monitoreo de salud |

---

## 3. Arquitectura del Sistema

### 3.1 Vista General (Monorepo)

```
abogado-soft/               ← Repositorio raíz
├── [Frontend]              ← React 19 + TypeScript + Vite 6
│   ├── App.tsx             ← Router principal (React Router 7)
│   ├── components/         ← 44 componentes + carpeta ui/
│   ├── contexts/           ← AuthContext, ToastContext
│   ├── electron/           ← Wrapper Electron (main.cjs, preload.cjs)
│   ├── index.html / index.tsx / index.css
│   └── vite.config.ts      ← Puerto 3000, alias @/
│
└── backend/                ← Bun + Express 5 + Prisma 7
    ├── src/
    │   ├── server.ts       ← Entry point, puerto 4000
    │   ├── routes/         ← 11 módulos de rutas REST
    │   ├── middleware/      ← auth, checkPermission, errorHandler, validate
    │   ├── lib/            ← prisma, supabase, googleDrive, backupService, websocket
    │   ├── services/       ← search/ (Meilisearch + Prisma adapter)
    │   └── cronJobs.ts     ← Backup automático diario (node-cron)
    └── prisma/
        ├── schema.prisma   ← 23 modelos, PostgreSQL 16
        └── seed.ts         ← Datos iniciales
```

### 3.2 Stack Tecnológico Detallado

#### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 19.x | UI library |
| TypeScript | ~5.8 | Tipado estático |
| Vite | 6.x | Build tool / dev server (puerto 3000) |
| React Router | 7.x | SPA routing con lazy loading |
| Supabase JS | 2.x | Autenticación (cliente) |
| Tiptap | 3.x | Editor de documentos rich-text (DOCX) |
| SuperDoc | 1.x | Visualización/edición avanzada de DOCX |
| xlsx | 0.18 | Lectura/escritura de hojas de cálculo |
| Lucide React | 0.577 | Iconografía |
| jsPDF + html2canvas | — | Exportar documentos como PDF |
| Yjs + HocusPocus | — | Colaboración en tiempo real (CRDT) |
| docx-preview | 0.3 | Vista previa de archivos DOCX |
| Electron | 40.x | Wrapper de escritorio (opcional) |

#### Backend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Bun | 1.x | Runtime + package manager |
| Express | 5.x | Framework HTTP |
| Prisma | 7.x | ORM + migraciones |
| PostgreSQL | 16 | Base de datos (vía Supabase) |
| Supabase | — | Auth, Realtime, Storage |
| Zod | 3.x | Validación de esquemas |
| Multer | 2.x | Upload de archivos |
| Mammoth | 1.x | Conversión DOCX → HTML |
| pdf-parse | — | Extracción de texto PDF |
| Meilisearch | 0.56 | Motor de búsqueda (self-hosted, opcional) |
| Socket.IO | 4.x | WebSockets |
| HocusPocus | 3.x | Servidor YJS para colaboración |
| Google APIs | 171.x | Integración Google Drive |
| bcryptjs | 3.x | Hash de contraseñas / PINs |
| jsonwebtoken | 9.x | JWT para sesiones |
| Archiver | 7.x | Generación de backups ZIP |
| node-cron | — | Tareas programadas (backup diario) |
| Helmet + CORS + Morgan | — | Seguridad y logging HTTP |

### 3.3 Comandos de Desarrollo

```bash
# Iniciar frontend solo
npm run dev                     # Vite en localhost:3000

# Iniciar backend solo
npm run dev:api                 # Bun watch en localhost:4000

# Iniciar ambos en paralelo
npm run dev:full                # concurrently

# Iniciar con Electron
npm run dev:electron

# Base de datos
npm run db:push                 # Prisma db push
npm run db:seed                 # Seed inicial
npm run db:studio               # Prisma Studio
```

---

## 4. Modelo de Datos (Prisma Schema)

La base de datos tiene **23 modelos** mapeados en PostgreSQL 16 con extensiones `uuid-ossp` y `pgcrypto`. Todas las tablas están en el esquema `public` con Row Level Security habilitado.

### 4.1 Enumeraciones del Sistema

| Enum | Valores |
|------|---------|
| `UserRole` | `admin`, `asistente` |
| `GroupRole` | `admin`, `editor`, `viewer` |
| `DocumentType` | `docx`, `doc`, `pdf`, `xlsx`, `xls`, `txt`, `rtf` |
| `FileStatus` | `ACTIVO`, `PENDIENTE`, `INACTIVO` |
| `CollaborationStatus` | `VISTO`, `EDITADO`, `COMENTADO`, `REVISADO`, `APROBADO`, `PENDIENTE_REVISION`, `RECHAZADO` |
| `SharingStatus` | `ENVIADO`, `ASIGNADO` |
| `PermissionLevel` | `none`, `download`, `read`, `write`, `admin` |
| `ConvenioStatus` | `activo`, `pendiente`, `vencido`, `expirado`, `cancelado` |
| `SyncStatus` | `pending`, `syncing`, `completed`, `failed` |
| `SyncOperation` | `create`, `update`, `delete` |
| `SyncEntityType` | `document`, `convenio`, `group`, `user`, `comment` |
| `BackupStatus` | `pending`, `in_progress`, `completed`, `failed` |
| `ActivityType` | 40 tipos de eventos (ver sección 4.2) |

### 4.2 Tipos de Actividad (Bitácora)

El sistema audita 40 tipos de eventos distribuidos en las siguientes categorías:

- **Sesión:** `LOGIN`, `LOGOUT`
- **Documentos:** `DOCUMENT_CREATED`, `DOCUMENT_UPDATED`, `DOCUMENT_DELETED`, `DOCUMENT_RESTORED`, `DOCUMENT_SHARED`, `DOCUMENT_ASSIGNED`, `DOCUMENT_DOWNLOADED`, `DOCUMENT_EXTRACTED`, `DOCUMENT_PERMISSION_CHANGED`, `DOCUMENT_VERSION_CREATED`, `DOCUMENT_COMMENT_ADDED`, `DOCUMENT_COMMENT_DELETED`, `DOCUMENT_VIEWED`, `DOCUMENT_LOCKED`, `DOCUMENT_UNLOCKED`
- **Convenios:** `CONVENIO_CREATED`, `CONVENIO_UPDATED`, `CONVENIO_DELETED`, `CONVENIO_VERSION_CREATED`, `CONVENIO_COMMENT_ADDED`, `CONVENIO_COMMENT_DELETED`
- **Grupos:** `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_DELETED`, `GROUP_MEMBER_ADDED`, `GROUP_MEMBER_REMOVED`
- **Seguridad:** `ADMIN_ACCESS_GRANTED`, `ADMIN_ACCESS_DENIED`, `PASSWORD_CHANGED`, `SETTINGS_CHANGED`
- **Backups:** `BACKUP_CREATED`, `BACKUP_RESTORED`
- **Usuarios:** `USER_REGISTERED`, `USER_UPDATED`
- **Colaboración:** `COLLABORATION_STARTED`, `COLLABORATION_ENDED`
- **Expedientes:** `CASE_CREATED`, `CASE_UPDATED`, `CASE_DOCUMENT_LINKED`, `CASE_DOCUMENT_UNLINKED`

### 4.3 Modelos Principales

#### `User` (usuarios)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK generado por `gen_random_uuid()` |
| `email` | VARCHAR(255) UNIQUE | Correo institucional |
| `name` | VARCHAR(255) | Nombre completo |
| `passwordHash` | VARCHAR(255)? | Hash bcrypt de contraseña |
| `role` | UserRole | `admin` o `asistente` |
| `avatarUrl` | String? | URL de foto de perfil |
| `phone` | VARCHAR(50)? | Teléfono de contacto |
| `officeName` | VARCHAR(255)? | Nombre de la oficina |
| `department` | VARCHAR(255)? | Departamento |
| `position` | VARCHAR(255)? | Cargo |
| `adminPinHash` | VARCHAR(255)? | Hash del PIN de acceso admin temporal |
| `isActive` | Boolean | Activo/inactivo en el sistema |
| `lastLogin` | Timestamptz? | Última sesión |

#### `Document` (documentos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(500) | Nombre del archivo |
| `type` | DocumentType | Extensión del archivo |
| `size` | BigInt | Tamaño en bytes |
| `localPath` | String? | Ruta local en el sistema de archivos |
| `cloudUrl` | String? | URL en Supabase Storage |
| `ownerId` | UUID? | Referencia al usuario propietario |
| `groupId` | UUID? | Grupo al que pertenece |
| `caseId` | UUID? | Expediente legal asignado |
| `fileStatus` | FileStatus | Estado del archivo (ACTIVO/PENDIENTE/INACTIVO) |
| `collaborationStatus` | CollaborationStatus? | Estado en flujo de revisión |
| `sharingStatus` | SharingStatus? | Estado de compartición |
| `version` | Int | Número de versión actual |
| `expirationDate` | Date? | Fecha de vencimiento |
| `isDeleted` | Boolean | Soft delete |
| `deletedAt` | Timestamptz? | Fecha de eliminación |
| `description` | String? | Descripción libre |
| `tags` | String[] | Etiquetas |
| `mimeType` | VARCHAR(255)? | MIME type |
| `driveFileId` | VARCHAR(255)? | ID en Google Drive |
| `syncStatus` | SyncStatus | Estado de sincronización con Drive |

#### `Convenio` (convenios)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `numero` | VARCHAR(100) UNIQUE | Número de convenio único |
| `institucion` | VARCHAR(255) | Institución contraparte |
| `departamento` | VARCHAR(255)? | Departamento involucrado |
| `descripcion` | String? | Descripción del convenio |
| `fechaInicio` | Date | Inicio de vigencia |
| `fechaFin` | Date | Fin de vigencia |
| `responsableId` | UUID? | Abogado responsable |
| `estado` | ConvenioStatus | Estado del convenio |
| `notas` | String? | Observaciones adicionales |
| `monto` | Decimal(14,2)? | Monto económico |
| `tableData` | JsonB? | Datos de la tabla Excel embebida |
| `driveFileId` | VARCHAR(255)? | ID en Google Drive |
| `syncStatus` | SyncStatus | Estado de sincronización |

#### `Case` (expedientes legales)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `caseNumber` | VARCHAR(100) UNIQUE | Número de expediente |
| `title` | VARCHAR(500) | Título del caso |
| `client` | VARCHAR(255)? | Cliente/parte |
| `court` | VARCHAR(255)? | Juzgado/tribunal |
| `caseType` | VARCHAR(100)? | Tipo de causa |
| `status` | VARCHAR(50) | Estado (`en_proceso`, etc.) |
| `description` | String? | Descripción |
| `startDate` | Date? | Fecha de inicio |
| `endDate` | Date? | Fecha de cierre |
| `responsibleId` | UUID? | Abogado responsable |

### 4.4 Modelos de Soporte

| Modelo | Propósito |
|--------|-----------|
| `Group` | Grupos de trabajo con código de invitación |
| `GroupMember` | Membresía usuario↔grupo con rol |
| `DocumentPermission` | Permisos granulares por usuario o grupo sobre documento |
| `DocumentAssignment` | Asignaciones de documentos con fecha límite y notas |
| `DocumentVersion` | Historial de versiones con checksum |
| `DocumentComment` | Comentarios anidados (hilos) en documentos |
| `ConvenioVersion` | Snapshot JSON de versiones de convenio |
| `ConvenioComment` | Comentarios anidados en convenios |
| `ConvenioDocument` | Relación N:M convenio↔documento |
| `CaseDocument` | Relación N:M expediente↔documento |
| `ActivityLog` | Bitácora completa de auditoría con metadatos JSON |
| `Backup` | Registro de respaldos (manual y automático) |
| `AdminAccessLog` | Log de accesos admin temporales a documentos |
| `DocumentAccessPin` | PINs de un solo uso para acceso admin temporal |
| `SyncQueue` | Cola de operaciones de sincronización pendientes |
| `UserSettings` | Preferencias por usuario (tema, idioma, auto-guardado) |
| `UserSession` | Sesiones activas con token, IP y expiración |
| `Notification` | Centro de notificaciones por usuario |
| `DocumentSyncLog` | Bitácora de sincronizaciones con Google Drive |

---

## 5. API REST (Backend)

El servidor Express 5 corre en `http://localhost:4000` y expone las siguientes rutas bajo el prefijo `/api`:

### 5.1 Endpoints por Módulo

#### `GET /api/health`
Health check básico del servidor. Retorna runtime, versión de Bun y timestamp.

#### `/api/auth` — Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/register` | Registro de nuevo usuario |
| POST | `/login` | Login con email/password → JWT |
| POST | `/logout` | Cierre de sesión |
| POST | `/refresh` | Renovación de token |
| GET | `/me` | Datos del usuario autenticado |

#### `/api/users` — Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar usuarios activos |
| GET | `/:id` | Detalle de usuario |
| PUT | `/:id` | Actualizar perfil |
| DELETE | `/:id` | Desactivar usuario |
| PATCH | `/:id/role` | Cambiar rol |
| GET | `/:id/activity` | Actividad del usuario |
| GET | `/:id/stats` | Estadísticas del usuario |
| POST | `/onboarding` | Completar perfil tras registro |

#### `/api/documents` — Documentos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar documentos con filtros |
| POST | `/` | Subir nuevo documento (multipart) |
| GET | `/:id` | Obtener documento y metadatos |
| PUT | `/:id` | Actualizar metadatos |
| DELETE | `/:id` | Soft delete (enviar a papelera) |
| POST | `/:id/restore` | Restaurar de papelera |
| GET | `/trash` | Listar papelera |
| DELETE | `/trash/:id` | Eliminación permanente |
| POST | `/:id/versions` | Crear nueva versión |
| GET | `/:id/versions` | Listar versiones históricas |
| GET | `/:id/versions/:versionId/diff` | Comparar versiones (diff HTML) |
| POST | `/:id/permissions` | Otorgar permiso a usuario/grupo |
| GET | `/:id/permissions` | Listar permisos del documento |
| PUT | `/:id/permissions/:permId` | Actualizar nivel de permiso |
| DELETE | `/:id/permissions/:permId` | Revocar permiso |
| POST | `/:id/share` | Compartir documento |
| POST | `/:id/admin-access` | Verificar PIN para acceso admin temporal |
| POST | `/:id/comments` | Agregar comentario |
| GET | `/:id/comments` | Listar comentarios |
| DELETE | `/:id/comments/:commentId` | Eliminar comentario |
| GET | `/recently-opened` | Documentos abiertos recientemente |
| GET | `/search` | Búsqueda global (Meilisearch o Prisma) |

#### `/api/assignments` — Asignaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Documentos asignados al usuario actual |
| POST | `/` | Crear nueva asignación |
| GET | `/:id` | Detalle de asignación |
| PUT | `/:id` | Actualizar estado / notas |
| DELETE | `/:id` | Eliminar asignación |

#### `/api/convenios` — Convenios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar con filtros (estado, año, búsqueda) |
| POST | `/` | Crear nuevo convenio |
| GET | `/:id` | Detalle de convenio |
| PUT | `/:id` | Actualizar convenio |
| DELETE | `/:id` | Eliminar convenio |
| POST | `/:id/versions` | Crear versión de convenio |
| GET | `/:id/versions` | Listar versiones |
| POST | `/:id/comments` | Agregar comentario |
| GET | `/:id/comments` | Listar comentarios |
| POST | `/:id/documents` | Adjuntar documento al convenio |
| DELETE | `/:id/documents/:docId` | Desadjuntar documento |
| GET | `/:id/export` | Exportar convenio (Excel/PDF) |

#### `/api/cases` — Expedientes Legales
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar expedientes |
| POST | `/` | Crear expediente |
| GET | `/:id` | Detalle |
| PUT | `/:id` | Actualizar |
| DELETE | `/:id` | Eliminar |
| POST | `/:id/documents` | Vincular documento al expediente |
| DELETE | `/:id/documents/:docId` | Desvincular documento |

#### `/api/groups` — Grupos de Trabajo
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar grupos del usuario |
| POST | `/` | Crear grupo |
| GET | `/:id` | Detalle del grupo |
| PUT | `/:id` | Actualizar grupo |
| DELETE | `/:id` | Eliminar grupo |
| POST | `/:id/members` | Agregar miembro |
| DELETE | `/:id/members/:userId` | Remover miembro |
| POST | `/join` | Unirse por código de invitación |

#### `/api/activity` — Bitácora
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar eventos con filtros (usuario, tipo, fecha) |
| GET | `/export` | Exportar bitácora |
| GET | `/stats` | Estadísticas de actividad |

#### `/api/backups` — Respaldos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar backups |
| POST | `/` | Generar backup manual |
| GET | `/:id` | Detalle del backup |
| POST | `/:id/restore` | Restaurar backup |
| DELETE | `/:id` | Eliminar backup |

#### `/api/notifications` — Notificaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar notificaciones del usuario |
| POST | `/:id/read` | Marcar como leída |
| POST | `/read-all` | Marcar todas como leídas |

#### `/api/drive` — Integración Google Drive
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/status` | Estado de la conexión con Drive |
| POST | `/sync/:documentId` | Sincronizar documento con Drive |
| POST | `/sync-all` | Sincronizar todos los documentos |
| GET | `/files` | Listar archivos en Drive |

### 5.2 Middleware de Seguridad

| Middleware | Función |
|------------|---------|
| `auth.ts` | Verifica JWT de Supabase en cada ruta protegida |
| `checkPermission.ts` | Valida permisos granulares por documento |
| `validate.ts` | Validación de body/params con Zod |
| `errorHandler.ts` | Manejo centralizado de errores HTTP |
| Helmet | Headers de seguridad HTTP |
| CORS | Solo acepta origen `localhost:3000` en dev |
| Morgan | Logging de todas las peticiones HTTP |

---

## 6. Frontend — Rutas y Componentes

### 6.1 Mapa de Rutas (React Router 7)

| Ruta | Componente | Acceso |
|------|-----------|--------|
| `/login` | `LoginPage` | Público (solo no autenticados) |
| `/registro` | `RegisterPage` | Público (solo no autenticados) |
| `/completar-perfil` | `CompleteProfilePage` | Protegido (sin layout) |
| `/` | `Dashboard` | Protegido |
| `/documentos` | `DocumentsList` | Protegido |
| `/asignados` | `AssignedList` | Protegido |
| `/convenios` | `AgreementsList` | Protegido |
| `/convenio/nuevo` | `ConvenioForm` | Protegido |
| `/convenio/:id` | `ConvenioDetails` | Protegido |
| `/convenio/:id/editar` | `ConvenioForm` | Protegido |
| `/convenio/:id/tabla` | `ExcelEditor` | Protegido |
| `/documento/:id` | `DocumentEditor` | Protegido |
| `/documento/:id/excel` | `DocumentXlsxEditor` | Protegido |
| `/equipo` | `TeamPage` | Protegido |
| `/equipo/usuario/:id` | `UserProfilePage` | Protegido |
| `/actividad` | `ActivityLog` | Protegido |
| `/seguridad` | `SecurityPage` | Protegido |
| `/papelera` | `TrashPage` | Protegido |
| `/terminos` | `TermsPage` | Protegido |
| `/privacidad` | `PrivacyPage` | Protegido |
| `/informacion-seguridad` | `SecurityInfoPage` | Protegido |
| `/health` | `HealthCheck` | Protegido |

Todas las rutas protegidas pasan por `ProtectedRoute` (verifica sesión activa) y están envueltas por `AppLayout` (sidebar + header + footer), con excepción de `/completar-perfil`.

### 6.2 Catálogo Completo de Componentes

#### Layout y Navegación
| Componente | Descripción |
|-----------|-------------|
| `AppLayout.tsx` | Layout principal: sidebar colapsable, header, footer, outlet de rutas |
| `AppHeader.tsx` | Barra superior: búsqueda global ⌘K, notificaciones, perfil |
| `AppFooter.tsx` | Pie de página con links a términos/privacidad |
| `AuthHeader.tsx` | Header simplificado para páginas de auth |

#### Autenticación y Perfil
| Componente | Descripción |
|-----------|-------------|
| `LoginPage.tsx` | Inicio de sesión con email/password via Supabase Auth |
| `RegisterPage.tsx` | Registro de cuenta nueva |
| `CompleteProfilePage.tsx` | Onboarding post-registro: nombre, cargo, oficina, PIN admin |
| `OnboardingWizard.tsx` | Guía paso a paso para nuevos usuarios |
| `ProtectedRoute.tsx` | Guard: redirige a login si no autenticado |
| `GuestRoute.tsx` | Guard: redirige al inicio si ya autenticado |

#### Dashboard
| Componente | Descripción |
|-----------|-------------|
| `Dashboard.tsx` | Página de inicio: KPIs, documentos recientes, documentos asignados, actividad en tiempo real, widgets con polling |

#### Documentos
| Componente | Descripción |
|-----------|-------------|
| `DocumentsList.tsx` | Vista de todos los documentos: grid/lista, filtros por tipo/estado/tag, búsqueda, subida |
| `DocumentEditor.tsx` | Editor embebido de DOCX (Tiptap + SuperDoc), con: historial de versiones, comentarios, compartir, modo enfoque, colaboración YJS en tiempo real |
| `DocumentXlsxEditor.tsx` | Editor de hojas de cálculo XLSX inline |
| `ExcelEditor.tsx` | Editor Excel avanzado para tablas de convenios |
| `DocumentPreviewPanel.tsx` | Panel lateral de vista previa visual (iframe para DOCX/PDF/XLSX) |
| `AssignedList.tsx` | Lista de documentos asignados al usuario actual, con filtros y estadísticas |
| `AssignModal.tsx` | Modal para asignar documento a un usuario |
| `ShareModal.tsx` | Modal para compartir: enlace copiable, share nativo del SO, share como PDF, asignar usuario |
| `DocumentPermissionsModal.tsx` | Gestión de permisos granulares por usuario o grupo |
| `AdminAccessModal.tsx` | Solicitud de acceso admin temporal vía PIN |
| `TrashPage.tsx` | Papelera con documentos eliminados (soft delete, recuperación 30 días) |
| `VersionDiffViewer.tsx` | Comparador visual de versiones (diff HTML resaltado) |
| `DiffSummaryPreview.tsx` | Resumen compacto de cambios entre versiones |
| `HistoryTab.tsx` | Pestaña de historial de versiones dentro del editor |
| `CommentsTab.tsx` | Pestaña de comentarios anidados (hilos) dentro del editor |
| `SuperDocPageSetupModal.tsx` | Configuración de paginación en SuperDoc |
| `SuperDocPageStrip.tsx` | Strip de páginas para navegación en SuperDoc |
| `EditorRouteErrorBoundary.tsx` | Error boundary específico para el editor |

#### Convenios
| Componente | Descripción |
|-----------|-------------|
| `AgreementsList.tsx` | Lista de convenios con filtros por estado, año, búsqueda y exportación |
| `ConvenioForm.tsx` | Formulario de creación/edición de convenios |
| `ConvenioDetails.tsx` | Vista detallada: metadatos, documentos adjuntos, versiones, comentarios, estado |

#### Equipo
| Componente | Descripción |
|-----------|-------------|
| `TeamPage.tsx` | Gestión del equipo: lista de miembros con roles, estadísticas, gestión de grupos, invitaciones |
| `UserProfilePage.tsx` | Perfil detallado de usuario: datos personales, actividad reciente, documentos |
| `UserAvatar.tsx` | Avatar de usuario con iniciales o foto |

#### Seguridad y Actividad
| Componente | Descripción |
|-----------|-------------|
| `ActivityLog.tsx` | Bitácora completa: filtros por tipo, usuario, rango de fechas, exportación, polling en tiempo real |
| `SecurityPage.tsx` | Panel de seguridad: cambio de contraseña, PIN admin, sesiones activas, gestión de backups |
| `SecurityInfoPage.tsx` | Información informativa sobre las medidas de seguridad |
| `DateRangeFilter.tsx` | Componente reutilizable de filtro por rango de fechas |

#### Notificaciones
| Componente | Descripción |
|-----------|-------------|
| `NotificationsDrawer.tsx` | Panel lateral deslizable de notificaciones con badge de no leídas |

#### Utilidades y Sistema
| Componente | Descripción |
|-----------|-------------|
| `HealthCheck.tsx` | Panel de diagnóstico: estado de API, base de datos, servicios |
| `ToastContainer.tsx` | Contenedor de notificaciones toast (éxito, error, info) |
| `TermsPage.tsx` | Términos y condiciones de uso |
| `PrivacyPage.tsx` | Política de privacidad |

### 6.3 Contextos de la Aplicación

| Contexto | Propósito |
|----------|-----------|
| `AuthContext` | Estado de autenticación global: usuario actual, sesión, funciones login/logout |
| `ToastContext` | Sistema de notificaciones toast global: `showToast(message, type)` |

---

## 7. Funcionalidades Detalladas

### 7.1 Autenticación y Sesión

- Login con email + contraseña via Supabase Auth
- Registro de cuenta + flujo de **onboarding** para completar perfil (nombre, cargo, oficina, teléfono, PIN de administrador)
- JWT almacenado en cliente; middleware del backend lo verifica en cada petición
- Gestión de sesiones activas: listado de dispositivos / IPs, revocación de sesiones individuales
- Expiración automática de sesiones (configurable)

### 7.2 Gestión de Documentos

#### Subida y organización
- Subida de archivos con `multipart/form-data` (Multer en el backend, almacenados en `backend/uploads/`)
- Soporte para: DOCX, DOC, PDF, XLSX, XLS, TXT, RTF
- Metadatos: nombre, descripción, etiquetas (`tags`), estado, tipo, fecha de vencimiento
- Vista en grid (tarjetas) y lista
- Filtros: tipo de archivo, estado (ACTIVO/PENDIENTE/INACTIVO), etiquetas, búsqueda full-text

#### Estados de documentos
- **File Status:** ACTIVO, PENDIENTE, INACTIVO
- **Collaboration Status:** VISTO, EDITADO, COMENTADO, REVISADO, APROBADO, PENDIENTE_REVISION, RECHAZADO
- **Sharing Status:** ENVIADO, ASIGNADO

#### Papelera y soft delete
- Al eliminar, el documento se marca con `isDeleted=true` y `deletedAt`
- La papelera lista documentos eliminados con opción de restaurar o eliminar permanentemente
- Retención por 30 días (configurable)

### 7.3 Editor de Documentos Embebido

El editor de documentos DOCX usa una arquitectura dual:

1. **Tiptap** (editor principal): Rich text con extensiones de colaboración, tablas, imágenes, alineación, subrayado, placeholder
2. **SuperDoc** (renderizado avanzado): Vista paginada con fidelidad al formato original de Word
3. **docx-preview**: Vista previa rápida sin edición en el panel lateral

#### Características del editor
- **Toolbar completa:** negrita, cursiva, subrayado, listas, tablas, imágenes, alineación, historial
- **Modo Enfoque (Focus Mode):** pantalla completa ocultando el sidebar, conservando los controles de cabecera
- **Auto-guardado:** cada 30 segundos (configurable en `UserSettings`)
- **Colaboración en tiempo real:** YJS + HocusPocus; cursores de colaboradores visibles
- **Historial de versiones:** creación de snapshots manuales con nota de cambio; diff visual entre versiones
- **Comentarios:** sistema de hilos anidados por documento con resolución de comentarios
- **Exportar a PDF:** conversión en el navegador con jsPDF + html2canvas
- **Compartir:** modal con enlace copiable, share nativo del SO (Web Share API), share como PDF
- **Permisos granulares:** gestión directa desde el editor

#### Editor XLSX (`DocumentXlsxEditor`, `ExcelEditor`)
- Lectura/escritura de hojas de cálculo con la librería `xlsx`
- Vista de tabla editable inline
- Modo especial para tablas de convenios (`/convenio/:id/tabla`)

### 7.4 Gestión de Convenios

Módulo especializado para convenios universidad-contraparte:

- **Campos:** número único, institución, departamento, descripción, fechas (inicio/fin), responsable, estado, notas, monto económico
- **Estados:** `activo`, `pendiente`, `vencido`, `expirado`, `cancelado`
- **Documentos adjuntos:** relación N:M con documentos del sistema
- **Versiones:** snapshots JSON completos de cada estado del convenio con nota de cambio
- **Comentarios:** hilos de comentarios anidados, igual que en documentos
- **Tabla de datos:** campo `tableData` (JsonB) para almacenar datos de la hoja Excel embebida
- **Exportación:** Excel / PDF del convenio
- **Integración Google Drive:** campo `driveFileId`, sincronización bidireccional

### 7.5 Expedientes Legales (Cases)

- CRUD de expedientes con número único, tipo de causa, juzgado/tribunal, cliente, fechas y responsable
- Vinculación N:M de documentos a expedientes
- Vista de expedientes con filtros por estado y tipo

### 7.6 Asignaciones de Documentos

- Un usuario puede **asignar** un documento a otro usuario con: fecha límite, notas, estado
- Estados: `pendiente`, `completado`, `cancelado`
- El destinatario ve los asignados en `/asignados` con filtros por estado
- Estadísticas (tarjetas): total, pendientes, revisados, activos
- Al completar una asignación se puede marcar como revisado

### 7.7 Sistema de Permisos y Acceso

#### Permisos por documento
Niveles jerárquicos: `none < download < read < write < admin`

- Pueden asignarse a **usuarios individuales** o a **grupos**
- Expiración configurable por permiso
- El propietario siempre tiene permiso `admin`

#### Acceso admin temporal (PIN)
Un usuario `asistente` puede solicitar acceso admin temporal sobre un documento específico:
1. Hace clic en **Acceso completo** en la tarjeta/editor del documento
2. Introduce el PIN del administrador (verificado en el backend con bcrypt)
3. Si es válido, se crea un `AdminAccessLog` con token de sesión temporal y expiración
4. El PIN puede ser de uso único (`DocumentAccessPin`) o el PIN general del `User.adminPinHash`
5. El acceso es **por sesión**, no modifica el rol permanente del usuario

### 7.8 Grupos de Trabajo

- Creación de grupos con nombre y descripción
- Roles dentro del grupo: `admin`, `editor`, `viewer`
- Código de invitación único para que otros se unan (`join`)
- Los grupos pueden tener permisos sobre documentos completos

### 7.9 Bitácora de Actividad (Activity Log)

- Registro automático de **40 tipos de eventos** para cada acción relevante del sistema
- Campos por evento: usuario, tipo, entidad (tipo + ID + nombre), descripción libre, metadatos JSON, IP
- Panel `/actividad` con:
  - Filtros combinados: tipo de evento, usuario, rango de fechas
  - Paginación
  - Polling en tiempo real (intervalo configurable)
  - Exportación
  - Estadísticas de actividad
  - Traducción al español de todos los tipos de eventos

### 7.10 Notificaciones

- Sistema de notificaciones en base de datos por usuario
- Tipos: `info`, `success`, `warning`, `error`
- Vinculadas a entidades (documento, convenio, etc.)
- `NotificationsDrawer`: panel lateral deslizable
- Badge de no leídas en el header
- Endpoint de marcado individual y masivo

### 7.11 Búsqueda Global

Implementación con **patrón Adapter** para intercambiar el motor de búsqueda:

- **Meilisearch** (primario, self-hosted): búsqueda fuzzy, autocompletado, relevancia
- **Prisma/PostgreSQL** (fallback): búsqueda full-text sin dependencia de infraestructura externa
- Activada con atajo de teclado **⌘K** (macOS) / **Ctrl+K** (Windows/Linux)
- Busca en: documentos, convenios, expedientes
- Resultados navegables con teclado

### 7.12 Google Drive Integration

- Autenticación con Service Account (JSON de credenciales en `backend/abogadosoft-600baea8efc9.json`)
- Sincronización bidireccional de documentos individuales y convenios
- Campo `driveFileId` y `driveRevisionId` en documentos
- `DocumentSyncLog` para auditoría de cada operación de sync
- `SyncQueue` para operaciones pendientes con reintentos (hasta 5 intentos)

### 7.13 Respaldos (Backups)

- **Backup manual:** desde `/seguridad`, genera un ZIP con todos los documentos y metadatos
- **Backup automático:** cron job diario a las 00:00 (node-cron)
- Los backups se almacenan en `backend/backups/`
- Registro en la tabla `Backup` con estado, tamaño, checksum y conteo de documentos
- Restauración desde el panel de seguridad

### 7.14 Dashboard (Página de Inicio)

La pantalla principal agrega:
- **KPIs en tarjetas:** total de documentos, pendientes de revisión, convenios activos, miembros del equipo
- **Documentos recientes:** últimos documentos abiertos/modificados por el usuario (`DOCUMENT_VIEWED`)
- **Documentos asignados:** pendientes con acceso rápido
- **Actividad reciente:** feed de bitácora con polling en tiempo real
- **Widgets de estado:** sincronización, backups, estado del sistema

### 7.15 Perfil de Usuario y Equipo

- `/equipo`: lista de todos los usuarios del sistema con rol, estado, estadísticas
- Clic en usuario → `/equipo/usuario/:id`: perfil completo, histórico de actividad, documentos
- Edición de perfil: nombre, foto, teléfono, cargo, oficina, departamento
- Cambio de contraseña y PIN de administrador

### 7.16 Seguridad y Privacidad

- Página `/seguridad`: cambio de contraseña, PIN admin, sesiones activas, historial de accesos admin, backups
- `/informacion-seguridad`: página informativa sobre las medidas de seguridad del sistema
- `/terminos` y `/privacidad`: documentos legales del servicio
- Todas las rutas sensibles requieren autenticación con JWT verificado

---

## 8. Diseño UI/UX

### 8.1 Principios de Diseño

> El software está diseñado para abogados universitarios de diversas edades. La curva de aprendizaje debe ser mínima.

1. **Botones grandes:** mínimo 44×44px táctil
2. **Texto legible:** mínimo 16px, títulos ≥ 20px
3. **Iconos + texto:** nunca solo iconos en acciones primarias
4. **Confirmaciones claras:** diálogos explícitos antes de acciones destructivas
5. **Retroalimentación inmediata:** toasts de éxito/error, spinners de carga
6. **Sin jerga técnica:** "Guardar" no "Commit"; "Papelera" no "Soft delete"

### 8.2 Sistema de Diseño

- **Fuente:** Inter (Google Fonts) para Títulos y Cuerpo; JetBrains Mono para monospace
- **Paleta:** Azul institucional primario (`#2563EB`), verde éxito, ámbar atención, rojo peligro
- **Modo oscuro/claro:** configurable en `UserSettings.theme`
- **Estilo:** Glassmorphism / claymorphism con bordes redondeados generosos, sombras suaves
- **Iconografía:** Lucide React (consistente y accesible)
- **Layout:** Sidebar colapsable a la izquierda, header fijo, content scrollable, footer
- **Responsive:** Grid adaptativo 1/2/3 columnas según viewport

### 8.3 Retroalimentación Visual

| Estado | Tratamiento |
|--------|-------------|
| Guardado exitoso | Toast verde con ✓ |
| Error de red | Toast rojo con mensaje específico |
| Cargando | Spinner animado con texto contextual |
| Sin datos | Estado vacío ilustrado con acción sugerida |
| Sincronizando | Indicador de sync en tiempo real |

---

## 9. Integraciones Externas

| Servicio | Propósito | Estado |
|---------|-----------|--------|
| **Supabase** | PostgreSQL (DB), Auth, Storage (opcional) | ✅ Activo |
| **Google Drive** | Backup y sync de archivos | ✅ Implementado |
| **Meilisearch** | Motor de búsqueda (self-hosted via Docker) | 🔄 Opcional |
| **Hocuspocus** | Servidor YJS para colaboración CRDT | ✅ Implementado |
| **Google Fonts** | Inter + JetBrains Mono | ✅ Activo |

---

## 10. Infraestructura y Despliegue

### 10.1 Variables de Entorno

El proyecto usa múltiples archivos `.env`:

**Frontend** (`.env` / `.env.local` en raíz):
- `VITE_API_URL` — URL del backend (default: `http://localhost:4000`)
- `VITE_SUPABASE_URL` — URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — Clave pública de Supabase
- `GEMINI_API_KEY` — (expuesto en el bundle vía Vite define)

**Backend** (`backend/.env`):
- `DATABASE_URL` — Connection string de PostgreSQL
- `DIRECT_URL` — Conexión directa (sin pooler) para Prisma
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase Admin
- `JWT_SECRET` — Secreto para firma de JWTs
- `PORT` — Puerto del servidor (default: 4000)
- `CORS_ORIGIN` — Origen permitido (default: `http://localhost:3000`)
- `GOOGLE_SERVICE_ACCOUNT_PATH` — Ruta al JSON de Service Account de Google

### 10.2 Despliegue Actual

- **Frontend:** desplegado en **Vercel** (directorio `.vercel/` presente)
- **Backend:** ejecutado localmente con Bun en desarrollo; pendiente de deploy en servidor
- **Base de datos:** PostgreSQL en **Supabase** (hosted)
- **Archivos:** almacenados en sistema de archivos local del backend (`backend/uploads/`)

### 10.3 Electron (Desktop)

El proyecto incluye soporte para empaquetado como aplicación de escritorio:
- `electron/main.cjs` — Proceso principal de Electron
- `electron/preload.cjs` — Bridge seguro renderer↔main
- Scripts: `npm run electron`, `npm run dev:electron`

---

## 11. Calidad y Auditoría

### 11.1 Seguridad de la Base de Datos

- **Row Level Security (RLS)** habilitado en todas las tablas `public`
- Vistas creadas sin `SECURITY DEFINER`
- Hashes bcrypt para contraseñas y PINs (nunca texto plano)
- Tokens JWT con expiración
- AdminAccessLog para trazabilidad de escaladas de privilegio

### 11.2 Monitoreo

- `/health` — endpoint de salud del servidor con diagnóstico completo
- `HealthCheck.tsx` — panel visual de estado de servicios desde la interfaz
- Morgan para logging HTTP en todos los ambientes

### 11.3 Respaldos

- Backups automáticos diarios (cron a las 00:00)
- Backups manuales bajo demanda desde `/seguridad`
- Almacenamiento local en `backend/backups/`

---

## 12. Métricas de Éxito

| Métrica | Objetivo |
|---------|----------|
| Tiempo de onboarding completo | < 5 minutos |
| Tasa de completación de tareas | > 95% |
| Tiempo para cargar/abrir documento | < 2 segundos |
| Disponibilidad del sistema | > 99% |
| Documentos sin pérdida de datos | 100% (backups + versiones) |

---

## 13. Estado del Roadmap

### ✅ Completado
- Setup completo del monorepo (Vite + Bun)
- Autenticación con Supabase Auth + JWT propio
- CRUD completo de documentos con soft delete y papelera
- Gestión de permisos granulares (5 niveles)
- Asignaciones de documentos entre usuarios
- Editor DOCX embebido (Tiptap + SuperDoc)
- Editor XLSX inline (xlsx)
- Historial de versiones con diff visual
- Comentarios anidados en documentos y convenios
- Módulo completo de convenios (CRUD + versiones + Excel)
- Módulo de expedientes legales (Cases)
- Grupos de trabajo con invitación por código
- Bitácora completa (40 tipos de eventos, polling en tiempo real)
- Sistema de notificaciones
- Búsqueda global con patrón Adapter (Meilisearch + Prisma fallback)
- Integración Google Drive (sync bidireccional)
- Sistema de backups (manual + automático diario)
- Panel de seguridad completo
- Dashboard con KPIs, documentos recientes y actividad en tiempo real
- Acceso admin temporal por PIN
- Onboarding wizard post-registro
- Documentos asignados con estadísticas
- Compartir: enlace + share nativo + share como PDF
- Vista previa visual de documentos (iframe)
- Modo enfoque en el editor
- Colaboración en tiempo real (YJS + HocusPocus)
- Deploy frontend en Vercel
- Wrapper Electron para uso como app de escritorio

### 🔄 Pendiente / Por definir
- Deploy del backend en servidor de producción
- Almacenamiento de archivos en Supabase Storage (actualmente sistema de archivos local)
- Configuración de Meilisearch en producción
- Notificaciones push / correo electrónico
- Autenticación 2FA
- Centro de ayuda offline integrado
- Mode completamente offline con sincronización al reconectar

---

> [!NOTE]
> Este PRD refleja el estado real del producto al 31 de marzo de 2026. Es un documento vivo que debe actualizarse conforme evolucionen las funcionalidades.
