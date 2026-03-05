+:----------------------------------:+:------------------------------------------------:+
| **Reporte de evidencias fotográficas**                                                |
+------------------------------------+--------------------------------------------------+
| Alumno:                            | Juan Leonardo Cruz Flores                        |
+------------------------------------+--------------------------------------------------+
| Matricula:                         | 202300097                                        |
+------------------------------------+--------------------------------------------------+
| Mes:                               | Enero 2026                                       |
+------------------------------------+--------------------------------------------------+
| Proyecto                           | AbogadoSoft: plataforma de gestión documental y  |
|                                    | colaborativa para despachos jurídicos.           |
+------------------------------------+--------------------------------------------------+
| Estancia:                          | 2                                                |
+------------------------------------+--------------------------------------------------+
| **Descripción**                                                                       |
+---------------------------------------------------------------------------------------+

# 1. Diseño de arquitectura y modelado de base de datos (Mes 1)

Arranqué definiendo la arquitectura del backend y el modelo de datos que
soporta a AbogadoSoft. Trabajé con mi asesor empresarial, el abogado de
la universidad, para validar los flujos de documentos y convenios;
colaboraciones entre su equipo y permisos a los documentos, y traduje
esos flujos a capas del servidor (servicios, repositorios y
controladores) más el diagrama entidad--relación. Las decisiones fueron:

## Arquitectura:

- Arquitectura en capas con Bun + Node.js, controladores HTTP y
  servicios de dominio independientes.

- Modelo relacional centralizado (PostgreSQL/Supabase) con
  sincronización local mediante SQLite para modo offline.

- Identificadores UUID y tablas para usuarios, grupos, documentos,
  convenios, permisos, bitácora y operaciones de sincronización.

El modelado quedó documentado en prisma/schema.prisma, acompañado de
migraciones iniciales y plantillas para futuras tablas de
sincronización.

## Entidades principales:

- **Usuario:** rol de aplicación (admin = abogado, asistente =
  auxiliar); campos de identificación, sesión y auditoría.

- **Documento:** tipo (docx, pdf, xlsx, etc.), rutas local y nube,
  propietario, grupo opcional, versión, soft delete; relación con
  permisos por documento.

- **Grupo:** nombre, descripción, propietario; miembros con rol en el
  grupo (admin, editor, viewer).

- **Convenio:** número, institución, fechas de vigencia, responsable,
  estado (activo, pendiente, vencido), documentos adjuntos y notas.

- **Permisos:** por usuario o por grupo sobre documentos; niveles none,
  download, read, write, admin.

## Enums y estados:

- **Estados de archivo:** ACTIVO, PENDIENTE, INACTIVO.

- **Estado de colaboración:** VISTO, EDITADO, REVISADO,
  PENDIENTE_REVISION, etc.

- **Operaciones de sincronización:** create, update, delete; estado:
  pending, syncing, completed, failed.

# 2. Configuración del entorno y autenticación inicial

Una vez definida la arquitectura, configuré el entorno de desarrollo
completo con Bun, Prisma y PostgreSQL 16 local. Creé los archivos .env y
prisma/.env con URLs de base de datos y llaves de Supabase, y dejé
documentados los scripts de arranque (bun run dev, bunx prisma generate,
bunx prisma db push). Además:

- Integré Supabase Auth para manejo de sesiones de abogados y
  auxiliares.

- Implementé middleware de autenticación y autorización por
  rol/permisos, aplicado en el router principal.

- Preparé el setup del monorepo para instalar dependencias y generar el
  cliente Prisma automáticamente.

## Stack:

- Runtime: Bun.

- ORM: Prisma con cliente PostgreSQL.

- Base de datos: PostgreSQL 16 (local y Supabase).

- Autenticación y nube: Supabase (Auth, Storage, Realtime según
  necesidad).

Con esto quedó listo el entorno para que otros miembros del equipo
puedan levantar el backend y autenticarse con Supabase sin pasos
manuales adicionales.

# 3. CRUD de documentos y almacenamiento local (SQLite)

La tercera actividad fue implementar el CRUD de documentos junto con el
almacenamiento local requerido por el cronograma. Creé el módulo
documents con rutas REST (/api/documents) y handlers para crear, listar,
actualizar y eliminar archivos. Los puntos más relevantes fueron:

- Persistencia dual: cada documento se guarda en PostgreSQL/Supabase y
  se replica en SQLite local con estados PENDING_SYNC, SYNCED o FAILED.

- Permisos por documento: antes de cada operación se valida si el
  usuario es propietario, miembro del grupo con rol suficiente o
  administrador global.

- Integración con Supabase Storage para subir la versión en la nube y
  almacenar la ruta local para edición offline.

- Hooks de Prisma que escriben en la tabla de sincronización para que el
  proceso de background empuje cambios cuando hay conexión.

### 4. Documentación de soporte y control de cambios

Ahora documento los avances del proyecto en manuales para registrar los
cambios y controlar las futuras implementaciones: actualicé el PRD con
el modelo definitivo, añadí instructivos de configuración en
ManualTecnico_AbogadoSoft.md y registré los cambios en Git (commits por
arquitectura, entorno y CRUD). Esto asegura trazabilidad para los
siguientes meses y permite que el frontend pueda consumir de inmediato
el backend básico.

### 5. Autenticación e integración con Supabase

Implementé la integración con Supabase para autenticación y, en su caso,
almacenamiento.

- **Login/logout:** Las rutas de auth delegan en Supabase Auth
  (email/contraseña). El backend valida el token recibido desde el
  frontend y mantiene la sesión según la configuración del cliente.

- **Protección de rutas:** El middleware de autenticación verifica el
  JWT o la sesión de Supabase en las peticiones a documentos, usuarios,
  grupos, convenios y asignaciones. Si el token es inválido o ha
  expirado, se responde con 401.

- **Reglas de negocio:** Se validan los roles de usuario
  (admin/asistente) y los permisos por documento (lectura, escritura,
  administrador) antes de permitir operaciones sobre documentos y
  grupos.

Con esto el backend queda preparado para que el frontend
(Electron/renderer) consuma login, logout y operaciones protegidas
mediante los endpoints definidos.

### 6. Control de versiones y documentación técnica

Mantuve el repositorio Git del proyecto con commits por tema: esquema
Prisma, rutas de auth, rutas de documentos, convenios, etc., para
facilitar la revisión y el rollback si fuera necesario. Y por último
agregué la documentación necesaria para continuar con el desarrollo
correcto del proyecto:

- **PRD_AbogadoSoft.md:** Requerimientos y modelo de datos de
  referencia.

- **ManualTecnico_AbogadoSoft.md:** Stack, estructura de carpetas,
  configuración y convenciones.

- **docs/PERMISOS.md:** Definición de roles de usuario, permisos por
  documento y roles en grupo.

# B. EVIDENCIAS FOTOGRÁFICAS

## Tablas creadas usando el ORM Prisma

![](media/image1.png){width="6.5in" height="4.1125in"}

## Variables de entorno

![](media/image2.png){width="6.5in" height="7.914583333333334in"}

## Estructura del Backend Completo

![](media/image3.png){width="2.9722222222222223in" height="4.0in"}
