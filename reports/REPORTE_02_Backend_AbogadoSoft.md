+------------------------------------+--------------------------------------------------+
| **Reporte de evidencias fotográficas**                                                |
+------------------------------------+--------------------------------------------------+
| Alumno:                            | Juan Leonardo Cruz Flores                        |
+------------------------------------+--------------------------------------------------+
| Matricula:                         | 202300097                                        |
+------------------------------------+--------------------------------------------------+
| Mes:                               | Febrero 2026                                     |
+------------------------------------+--------------------------------------------------+
| Proyecto                           | AbogadoSoft: plataforma de gestión documental y  |
|                                    | colaborativa para despachos jurídicos.           |
+------------------------------------+--------------------------------------------------+
| Estancia:                          | 2                                                |
+------------------------------------+--------------------------------------------------+
| **Descripción**                                                                       |
+---------------------------------------------------------------------------------------+

# 1. Modelo de Grupos y Permisos (Mes 2)

Arranqué el segundo mes enfocándome en la fase de colaboración, definiendo e implementando el esquema para manejar grupos de trabajo y permisos granulares sobre los documentos en la base de datos (PostgreSQL vía Prisma). Las decisiones fueron:

## Entidades agregadas:

- **Grupo:** propietario y múltiples miembros con roles específicos en el grupo (admin, editor, viewer).

- **Permisos Granulares:** asignación de niveles de acceso (none, download, read, write, admin) a usuarios individuales o grupos enteros sobre un documento.

- **Asignación de Documentos:** delegación de tareas o revisión de documentos a usuarios específicos, controlando estados (pendiente, etc.) y fechas límite de entrega.

Todo este modelo quedó integrado en prisma/schema.prisma y migrado exitosamente hacia Supabase.

# 2. Implementación de Rutas API para Grupos y Asignaciones

Una vez definida la estructura de la base de datos, configuré las rutas RESTful bajo los módulos /api/groups y /api/assignments, exponiendo todas las operaciones necesarias para la colaboración. Además:

- Creé el CRUD en groups.routes.ts para listar, crear, modificar y eliminar grupos, incluyendo la autogeneración de códigos de invitación (inviteCode) en un endpoint dedicado.

- Implementé endpoints para gestionar miembros (/api/groups/:id/members), integrándolos con los permisos preestablecidos.

- Construí el controlador assignments.routes.ts para que los usuarios puedan visualizar rápidamente los documentos que se les han turnado.

- Conecté todos los endpoints con la tabla ActivityLog para registrar automáticamente eventos de auditoría como la creación de grupos o asignaciones.

# 3. Sistema Base de Sincronización y Cola Offline

La tercera actividad fue implementar la estructura principal que gestiona operaciones pendientes, logrando el control requerido para soportar trabajo sin conexión. Los puntos más relevantes fueron:

- Cola de Sincronización (SyncQueue): agregué un gestor de cola en Prisma que registra la entidad afectada (document, convenio, group), la operación (create, update, delete) y la carga útil.

- Estados de Gestión Offline: la cola arranca con estado pending, pasa a syncing y termina en completed o failed, previniendo pérdida de datos en el cliente.

- Lógica de Reintentos: configuré un mecanismo de reintentos en el modelo para operaciones fallidas y un registro de errores para preparar la base de los workers asíncronos posteriores.

### 4. Refuerzo de Reglas de Seguridad y Autenticación Continua

Terminé el periodo consolidando las validaciones y los controles de acceso a las nuevas funcionalidades. Modifiqué middlewares y definí validaciones estrictas:

- Seguridad Distribuida: ajusté el middleware de autorización para validar la membresía del usuario en un grupo (GroupRole) además del rol de aplicación.

- Validación Estricta: implementé esquemas Zod en las nuevas rutas para verificar los tipos de dato en las entradas del CRUD de grupos y asignaciones.

- Roles en Edición de Documentos: integré la capa lógica en documents.routes.ts para respetar parámetros y niveles de autorización (PermissionLevel) explícitamente delegados a un grupo.

### 5. Control de avances frente al cronograma

Mantuve el avance documentado y logré las siguientes metas correspondientes al mes 2 de la estancia:

- Modelo colaborativo extendido con tablas Group, GroupMember, DocumentPermission y DocumentAssignment listas.

- APIs interactivas para gestión de grupos y asignaciones finalizadas.

- Mecanismo offline funcional con tabla SyncQueue preparada para manejo de operaciones encoladas.

- Middlewares de validación y logs de auditoría integrados con Prisma.

# B. EVIDENCIAS FOTOGRÁFICAS

Las siguientes capturas se generan con **Prisma Studio** y validaciones de API (Postman). Instrucciones de visualización local en `reports/evidencias/README.md`.

## Prisma Studio — tabla Groups y GroupMembers

![](evidencias/prisma-studio-grupos.png)

## Prisma Studio — Entidad SyncQueue (Estados Offline)

![](evidencias/prisma-studio-syncqueue.png)

## Prisma Studio — ActivityLog para creación de Grupos

![](evidencias/prisma-studio-logsgroup.png)

## Postman o similar — petición a /api/groups

*(Captura: Creación exitosa de un grupo de estudio/trabajo.)*

![](evidencias/api-groups.png)

## Postman o similar — petición a /api/assignments

*(Captura: Asignación de documento con fecha límite.)*

![](evidencias/api-assignments.png)
