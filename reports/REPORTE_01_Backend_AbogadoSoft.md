# ANEXO I
## REPORTE DE ESTANCIA — PRIMER PERIODO (BACKEND)

**NOMBRE PROYECTO:** AbogadoSoft (Backend)

**NOMBRE:** Juan Leonardo Cruz Flores

**MATRÍCULA:** 202300097

**PRÁCTICA PROFESIONAL:** EI / EII / **ESTADÍA** / SS / ESC. DE PRÁCTICA

**REPORTE NO.** ______________  **INTERVALO DE FECHAS:** ______________

---

## A. DESCRIPCIÓN DE ACTIVIDADES REALIZADAS

### 1. Diseño de arquitectura y modelado de base de datos (Mes 1)

Arranqué la estancia siguiendo el cronograma del mes 1, dedicado a definir la arquitectura del backend y el modelo de datos que soporta a AbogadoSoft. Trabajé con el asesor empresarial para validar los flujos de documentos y convenios, y traduje esos flujos a capas del servidor (servicios, repositorios y controladores) más el diagrama entidad–relación. Las decisiones clave fueron:

- Arquitectura en capas con Bun + Node.js, controladores HTTP y servicios de dominio independientes.
- Modelo relacional centralizado (PostgreSQL/Supabase) con sincronización local mediante SQLite para modo offline.
- Identificadores UUID y tablas para usuarios, grupos, documentos, convenios, permisos, bitácora y operaciones de sincronización.

El modelado quedó documentado en `prisma/schema.prisma`, acompañado de migraciones iniciales y plantillas para futuras tablas de sincronización.

---

### 2. Configuración del entorno y autenticación inicial

Una vez definida la arquitectura, configuré el entorno de desarrollo completo con Bun, Prisma y PostgreSQL 16 local. Creé los archivos `.env` y `prisma/.env` con URLs de base de datos y llaves de Supabase, y dejé documentados los scripts de arranque (`bun run dev`, `bunx prisma generate`, `bunx prisma db push`). Además:

- Integré Supabase Auth para manejo de sesiones de abogados y auxiliares.
- Implementé middleware de autenticación y autorización por rol/permisos, aplicado en el router principal.
- Preparé el `setup` del monorepo para instalar dependencias y generar el cliente Prisma automáticamente.

Con esto quedó listo el entorno para que otros miembros del equipo puedan levantar el backend y autenticarse con Supabase sin pasos manuales adicionales.

---

### 3. CRUD de documentos y almacenamiento local (SQLite)

La tercera actividad del mes 1 fue implementar el CRUD de documentos junto con el almacenamiento local requerido por el cronograma. Creé el módulo `documents` con rutas REST (`/api/documents`) y handlers para crear, listar, actualizar y eliminar archivos. Los puntos más relevantes fueron:

- Persistencia dual: cada documento se guarda en PostgreSQL/Supabase y se replica en SQLite local con estados `PENDING_SYNC`, `SYNCED` o `FAILED`.
- Permisos por documento: antes de cada operación se valida si el usuario es propietario, miembro del grupo con rol suficiente o administrador global.
- Integración con Supabase Storage para subir la versión en la nube y almacenar la ruta local para edición offline.
- Hooks de Prisma que escriben en la tabla de sincronización para que el proceso de background empuje cambios cuando hay conexión.

También añadí pruebas manuales con Postman y Prisma Studio para verificar creación y sincronización de registros, dejando capturas en las evidencias.

---

### 4. Documentación de soporte y control de cambios

Cerré el periodo dejando evidencia de las actividades del mes 1: actualicé el PRD con el modelo definitivo, añadí instructivos de configuración en `ManualTecnico_AbogadoSoft.md` y registré los cambios en Git (commits por arquitectura, entorno y CRUD). Esto asegura trazabilidad para los siguientes meses y permite que el frontend pueda consumir de inmediato el backend básico.

---


### 2. Modelo de datos y esquema en base de datos

Definí el modelo de datos local y en nube según el PRD y la documentación de permisos.

**Entidades principales:**

- **Usuario:** rol de aplicación (`admin` = abogado, `asistente` = auxiliar); campos de identificación, sesión y auditoría.
- **Documento:** tipo (docx, pdf, xlsx, etc.), rutas local y nube, propietario, grupo opcional, versión, soft delete; relación con permisos por documento.
- **Grupo:** nombre, descripción, propietario; miembros con rol en el grupo (`admin`, `editor`, `viewer`).
- **Convenio:** número, institución, fechas de vigencia, responsable, estado (activo, pendiente, vencido), documentos adjuntos y notas.
- **Permisos:** por usuario o por grupo sobre documentos; niveles `none`, `download`, `read`, `write`, `admin`.

**Enums y estados:**

- Estados de archivo: ACTIVO, PENDIENTE, INACTIVO.
- Estado de colaboración: VISTO, EDITADO, REVISADO, PENDIENTE_REVISION, etc.
- Operaciones de sincronización: create, update, delete; estado: pending, syncing, completed, failed.

El esquema se implementó con Prisma (ORM) y PostgreSQL, con migraciones versionadas y extensión de UUID para identificadores. Las tablas quedan alineadas al modelo del PRD y al documento de permisos (roles de usuario, permisos por documento, roles en grupo).

---

### 3. Configuración del proyecto backend

Configuré el espacio de trabajo del backend con las tecnologías definidas en el Manual Técnico.

**Stack:**

- **Runtime:** Bun.
- **ORM:** Prisma con cliente PostgreSQL.
- **Base de datos:** PostgreSQL 16 (local y Supabase).
- **Autenticación y nube:** Supabase (Auth, Storage, Realtime según necesidad).

**Variables de entorno (.env):**

```env
# Base de datos (PostgreSQL / Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
SUPABASE_URL="https://....supabase.co"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

**Scripts en package.json del backend:**

- `bun run dev`: servidor en desarrollo con recarga.
- `bun run build`: compilación para producción.
- `bunx prisma generate`: generación del cliente Prisma.
- `bunx prisma db push` / `prisma migrate`: aplicación del esquema a la base de datos.
- `bun run prisma:seed`: datos iniciales de prueba.

Desde la raíz del monorepo se dejó un script `setup` que instala dependencias del frontend y del backend y ejecuta `prisma generate` para que el backend quede listo para desarrollo.

---

### 4. Estructura de módulos y rutas API

Organicé el backend en módulos por dominio y definí las rutas que expondrá la API.

**Estructura de carpetas (backend):**

```
backend/
├── prisma/
│   ├── schema.prisma    # Modelo y migraciones
│   └── seed.ts          # Datos iniciales
├── src/
│   ├── server.ts        # Entrada del servidor
│   ├── lib/
│   │   ├── prisma.ts    # Cliente Prisma
│   │   ├── supabase.ts  # Cliente Supabase
│   │   └── websocket.ts # WebSocket si aplica
│   ├── middleware/
│   │   ├── auth.ts      # Autenticación y sesión
│   │   ├── errorHandler.ts
│   │   └── validate.ts
│   └── routes/
│       ├── auth.routes.ts
│       ├── documents.routes.ts
│       ├── users.routes.ts
│       ├── groups.routes.ts
│       ├── convenios.routes.ts
│       ├── assignments.routes.ts
│       ├── collaboration.routes.ts
│       ├── activity.routes.ts
│       ├── notifications.routes.ts
│       ├── backups.routes.ts
│       └── cases.routes.ts
├── package.json
└── tsconfig.json
```

**Rutas por recurso (resumen):**

| Recurso        | Descripción principal                                      |
|----------------|-------------------------------------------------------------|
| /api/auth      | Login, logout, sesión, verificación de token                |
| /api/documents | CRUD documentos; permisos; compartir y asignar               |
| /api/users     | Listado y perfil de usuarios (según permisos)             |
| /api/groups    | CRUD grupos y miembros                                     |
| /api/convenios | CRUD convenios; filtros por estado y fechas                 |
| /api/assignments | Documentos asignados al usuario actual; estados            |
| /api/activity  | Bitácora y logs de actividad                               |
| /api/backups   | Endpoints de respaldo (según política del proyecto)         |

El servidor centraliza CORS, parsing JSON y el registro de estas rutas; el middleware de autenticación protege las rutas que requieren sesión válida.

---

### 5. Autenticación e integración con Supabase

Implementé la integración con Supabase para autenticación y, en su caso, almacenamiento.

- **Login/logout:** Las rutas de auth delegan en Supabase Auth (email/contraseña). El backend valida el token recibido desde el frontend y mantiene la sesión según la configuración del cliente.
- **Protección de rutas:** El middleware de autenticación verifica el JWT o la sesión de Supabase en las peticiones a documentos, usuarios, grupos, convenios y asignaciones. Si el token es inválido o ha expirado, se responde con 401.
- **Reglas de negocio:** Se validan los roles de usuario (`admin`/`asistente`) y los permisos por documento (lectura, escritura, administrador) antes de permitir operaciones sobre documentos y grupos.

Con esto el backend queda preparado para que el frontend (Electron/renderer) consuma login, logout y operaciones protegidas mediante los endpoints definidos.

---

### 6. Control de versiones y documentación técnica

Mantuve el repositorio Git del proyecto con commits por tema: esquema Prisma, rutas de auth, rutas de documentos, convenios, etc., para facilitar la revisión y el rollback si fuera necesario.

En la raíz del proyecto existen:

- **PRD_AbogadoSoft.md:** Requerimientos y modelo de datos de referencia.
- **ManualTecnico_AbogadoSoft.md:** Stack, estructura de carpetas, configuración y convenciones.
- **docs/PERMISOS.md:** Definición de roles de usuario, permisos por documento y roles en grupo.

Estos documentos sirven como referencia única para el diseño del backend y para futuros reportes de avance (sincronización nube-local, cola offline, Cloud Functions, etc.).

---

## B. EVIDENCIAS FOTOGRÁFICAS

Las siguientes capturas se generan con **Prisma Studio** (`bunx prisma studio` desde `backend/`) y otras herramientas. Instrucciones en `reports/evidencias/README.md`.

1. **Prisma Studio — listado de tablas**  
   ![Prisma Studio - Tablas](evidencias/prisma-studio-tablas.png)

2. **Prisma Studio — tabla Users (ejemplo)**  
   ![Prisma Studio - Users](evidencias/prisma-studio-users.png)

3. **Prisma Studio — tabla Documents (ejemplo)**  
   ![Prisma Studio - Documents](evidencias/prisma-studio-documents.png)

4. **Postman o similar — petición a /api/auth**  
   *(Captura: login o verificación de token.)*  
   ![API Auth](evidencias/api-auth.png)

5. **Postman o similar — petición a /api/documents**  
   *(Captura: listado o CRUD de documentos.)*  
   ![API Documents](evidencias/api-documents.png)

6. **Estructura de carpetas del backend**  
   ![Estructura backend](evidencias/estructura-backend.png)

7. **Variables de entorno (anonimizadas)**  
   ![Variables .env](evidencias/env-anonimizado.png)

---

## C. ETAPAS CUMPLIDAS

1. Revisión de documentación (PRD, Manual Técnico, Permisos) y definición del alcance backend.
2. Modelo de datos definido y esquema implementado con Prisma y PostgreSQL (usuarios, documentos, grupos, convenios, permisos y entidades de sincronización).
3. Proyecto backend configurado con Bun, Prisma y variables de entorno para PostgreSQL y Supabase.
4. Estructura de módulos y rutas API definida (auth, documents, users, groups, convenios, assignments, activity, backups, etc.).
5. Autenticación integrada con Supabase y middleware de protección de rutas.
6. Control de versiones con Git y documentación técnica de referencia actualizada.

---

**NOMBRE Y FIRMA DEL ESTUDIANTE**

Juan Leonardo Cruz Flores

_________________________________________________
