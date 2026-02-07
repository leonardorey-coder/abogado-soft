# Contenido para Propuesta de Estancia 2026 - AbogadoSoft (Enfoque Backend)

Texto adaptado al **backend** del proyecto: proceso principal de Electron, base de datos local, sincronización con nube y servicios serverless. Para copiar en el documento Word de la propuesta cuando el enfoque sea la parte de backend.

---

## DEFINICIÓN DEL PROYECTO (BACKEND)

### Planteamiento del Problema

La aplicación AbogadoSoft requiere una capa de backend que resuelva: (1) persistencia local confiable para documentos y metadatos (Usuario, Documento, Grupo, Convenio) con posibilidad de trabajo offline; (2) autenticación y autorización (roles admin/abogado/asistente, permisos por grupo); (3) sincronización bidireccional entre la base local (SQLite) y la nube (Firebase/Supabase) con resolución de conflictos y cola de operaciones en ausencia de red; y (4) exposición segura de operaciones al frontend vía IPC (Electron main process) y APIs de almacenamiento y tiempo real en la nube.

Los aspectos del problema son la consistencia de datos entre cliente y servidor, la seguridad de documentos en reposo y en tránsito, el rendimiento de consultas e indexación local, y la lógica serverless (Cloud Functions) para validaciones, notificaciones y reportes. Las relaciones entre persistencia local, sincronización, autenticación y permisos exigen un diseño claro de modelo de datos, flujos de sincronización y manejo de errores y reintentos.

---

### Objetivos

**Objetivo general**

Diseñar e implementar la capa de backend de AbogadoSoft: proceso principal de Electron con base de datos SQLite local, handlers IPC, sincronización con Firebase/Supabase (autenticación, storage, Firestore/Realtime DB) y lógica serverless (Cloud Functions), garantizando persistencia offline, consistencia de datos y seguridad.

**Objetivos específicos**

1. Implementar el modelo de datos local (Usuario, Documento, Grupo, GroupMember, Convenio, Permission) en SQLite dentro del main process de Electron, con migraciones y consultas optimizadas (índices, lazy loading).
2. Definir e implementar los handlers IPC que expongan al renderer las operaciones de CRUD sobre documentos, grupos, permisos y convenios, más operaciones de compartir (generar enlace, asignar documento a usuario) y consulta de documentos asignados al usuario actual, con validación y auditoría básica.
3. Integrar autenticación con Firebase/Supabase (login/logout, sesión, 2FA opcional) y reglas de seguridad (Firestore/Storage) según roles y permisos por grupo.
4. Desarrollar el módulo de sincronización nube-local: detección de cambios, cola de operaciones pendientes en offline, resolución de conflictos (por ejemplo última escritura o versión) y notificación al frontend del estado de sincronización.
5. Implementar Cloud Functions (o equivalente) para lógica serverless: validación de convenios, alertas de vencimiento, backups programados y logs de auditoría; y configurar almacenamiento seguro de archivos (Storage) con encriptación en reposo.

---

### Alcances y entregables finales

**Alcances (backend)**

- **Proceso principal (Electron):** Node.js + Electron 28+; módulos `database/` (SQLite), `sync/`, `ipc/`; file watching (Chokidar) para detección de cambios locales; auto-updater.
- **Base de datos local:** SQLite con esquema alineado al modelo del PRD (usuarios, documentos, grupos, miembros, convenios, permisos); soporte para compartir y asignación de documentos a usuarios (permisos por documento, estado asignado/revisado); soft delete y versionado; índices para búsqueda y filtros por estado/fecha.
- **Nube:** Firebase o Supabase para Auth, Storage (archivos), Firestore o Realtime DB (metadatos y sincronización en tiempo real); Cloud Functions para validaciones, alertas y reportes.
- **Sincronización:** flujo guardado local inmediato + envío asíncrono a nube; marcar pendientes cuando no hay conexión; sincronizar al reconectar; historial de versiones (últimas 10) y papelera (30 días) reflejados en backend.
- **Seguridad:** encriptación de documentos en reposo; tokens y reglas de acceso; logs de auditoría; backup automático diario (configurable desde backend).

**Entregables finales (backend)**

1. Código del main process con módulos database (SQLite), sync e IPC; esquema y migraciones documentados; soporte en modelo e IPC para compartir documento (enlace, asignación a usuario) y listado de documentos asignados.
2. Integración completa con Firebase/Supabase: Auth, Storage, Firestore/Realtime DB y al menos dos Cloud Functions (ej. alerta vencimiento convenios, backup/auditoría).
3. Módulo de sincronización operativo: cola offline, resolución de conflictos, notificación de estado al frontend.
4. Documentación técnica de APIs IPC, modelo de datos, flujo de sincronización y despliegue de servicios en nube.

---

### Metodología de desarrollo

Se utilizará un enfoque ágil iterativo con fases alineadas al backend del PRD:

- **Fase 1 (MVP):** Setup del main process; esquema SQLite (Usuario, Documento, Convenio); CRUD vía IPC; integración Auth (Firebase/Supabase); almacenamiento local de archivos y metadatos.
- **Fase 2 (Colaboración):** Modelo de grupos y permisos en SQLite y en nube; reglas de seguridad Firestore/Storage; sincronización inicial (upload/download) y estado "pendiente" en offline.
- **Fase 3 (Sincronización robusta):** Cola de operaciones pendientes; detección de cambios (timestamp/versión); resolución de conflictos; notificaciones al renderer; historial de versiones en backend.
- **Fase 4 (Convenios y lógica serverless):** Persistencia y sincronización de convenios; Cloud Functions para alertas de vencimiento y reportes; backup automático y auditoría.
- **Fase 5 (Cierre):** Optimización de consultas e índices; documentación de APIs y flujos; pruebas de carga y recuperación ante fallos de red.

**Justificación:** El backend se construye en capas (persistencia local, IPC, nube, sync) para validar cada bloque con el frontend de forma incremental. La metodología ágil permite ajustar el modelo de datos y las reglas de sincronización con base en feedback real de uso (por ejemplo conflictos o lentitud), y priorizar seguridad y consistencia desde el diseño.

---

### Cronograma de trabajo / Cronograma de actividades (Backend)

| Etapa | Actividad | Mes 1 | Mes 2 | Mes 3 | Mes 4 |
|-------|-----------|:-----:|:-----:|:-----:|:-----:|
| 1. MVP Backend | Main process; SQLite (esquema, migraciones); IPC CRUD; Auth Firebase/Supabase; Storage local y nube | X | | | |
| 2. Grupos y permisos | Modelo grupos/permisos en DB y nube; reglas de seguridad; sync básico y cola offline | | X | | |
| 3. Sincronización | Cola pendientes; detección cambios; resolución conflictos; notificaciones; versiones y papelera | | | X | |
| 4. Convenios y Cloud | Convenios en DB y nube; Cloud Functions (alertas, reportes, backup/auditoría) | | | | X |
| 5. Cierre Backend | Índices y optimización; documentación APIs/sync; pruebas de red y recuperación | | | | X |

(Ajustar Mes 1–4 según duración real de la estancia.)

---

### Asignaturas y temas aplicables al proyecto (Backend) – mínimo 3 asignaturas y 5 temas

| Asignatura | Temas aplicables |
|------------|------------------|
| Bases de Datos | Modelado relacional (Usuario, Documento, Grupo, Convenio, Permission); SQL y SQLite; índices y optimización de consultas; transacciones y consistencia. |
| Redes o Sistemas Distribuidos | Sincronización cliente-servidor; colas offline; resolución de conflictos; protocolos y APIs REST/Realtime. |
| Seguridad en Computación (o similar) | Autenticación y autorización; tokens; encriptación en reposo y en tránsito; reglas de acceso y auditoría. |
| Desarrollo de Aplicaciones (backend) | Node.js; procesos (Electron main); IPC; integración con servicios en nube (Firebase/Supabase); Cloud Functions. |
| Ingeniería de Software | Requisitos no funcionales (rendimiento, disponibilidad); documentación de APIs; pruebas e integración. |

**Temas concretos (5):** (1) Modelado de datos y SQLite (esquema, migraciones, consultas), (2) Autenticación y autorización (Firebase/Supabase Auth y reglas), (3) Sincronización nube-local y manejo offline, (4) APIs IPC y servicios en nube (Storage, Firestore), (5) Lógica serverless (Cloud Functions) y seguridad (encriptación, logs, backup).

---

*Contenido adaptado al backend a partir del PRD_AbogadoSoft.md para la propuesta de proyecto de estancia 2026.*
