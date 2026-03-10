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

### 1. Modelo de Grupos y Permisos Granulares (Mes 2)

Arranqué el segundo mes enfocándome en la fase de colaboración, definiendo e implementando el esquema amplio para manejar grupos de trabajo y permisos granulares sobre los documentos en la base de datos (PostgreSQL vía Prisma). El objetivo de esta etapa fue establecer las bases para que los despachos jurídicos puedan aislar su información entre diferentes equipos u oficinas. Las decisiones fueron:

- **Aislamiento de Usuarios por Equipo/Oficina:** Desarrollo del modelo y lógica en el backend para agrupar usuarios orgánicamente. Ajusté las consultas SQL/Prisma para que cada usuario solo vea información (documentos, convenios y miembros) pertinente a su propia oficina.
- **Permisos Granulares por Documento:** Asignación de niveles de acceso (`none`, `download`, `read`, `write`, `admin`) a usuarios individuales o grupos enteros sobre un documento específico, almacenados en la tabla `DocumentPermission`.
- **Delegación Dinámica y Auditoría:** Integración de este modelo con Supabase Auth y Prisma, asegurando que cada asignación de documentos (lectura, firma, revisión) sea validada y auditada desde el core del servidor.

### 2. Implementación de Rutas API para Asignaciones y Módulo de Equipos

Una vez definida la estructura de la base de datos, configuré las rutas RESTful bajo los módulos `/api/groups`, `/api/users` y `/api/assignments`, exponiendo todas las operaciones necesarias para la colaboración integral entre abogados universitarios. Además:

- **Operaciones de Grupos y Roles:** Creé el CRUD en `groups.routes.ts` para listar, crear, modificar y eliminar grupos, incluyendo la gestión de roles internos de los miembros (admin, editor, viewer) y la autogeneración de códigos de invitación corporativos.
- **Gestor de Asignaciones (Assignments):** Construí el controlador `assignments.routes.ts` que permite a los usuarios asignar y recibir notificaciones de sistema sobre documentos turnados. Cada petición de asignación procesada por el servidor contempla fechas límite, niveles de urgencia y estados de revisión.
- **Correcciones Críticas de Onboarding:** Atendí incidencias del flujo de nuevos usuarios, asegurando en el API que, al registrarse o unirse a un nuevo despacho, se completen todos los registros de perfiles, roles y vinculaciones necesarias en el backend de forma transaccional, evitando cuentas huérfanas o exposición de datos entre distintas firmas.

### 3. Bitácora Centralizada y Auditoría de Actividad

De acuerdo a los objetivos de seguridad del proyecto, desarrollé un sistema de logs en el backend que consolida y traza la actividad de todos los módulos vitales del sistema (documentos, convenios, seguridad de accesos, asignaciones y grupos).

- **API de Bitácora Global (`/api/activity`):** Centralización de los registros de auditoría provenientes de la tabla `ActivityLog`.
- **Filtros Avanzados y Paginación:** Implementación de endpoints optimizados para realizar búsquedas granulares y filtrado por categoría (e.g., control de versiones, inicio de sesión, cambio de permisos) y usuario responsable, logrando búsquedas eficientes.
- **Rastreo y Presencia (Último Acceso):** Refinamiento del control de seguridad en `/api/auth` y en los handlers de usuarios para registrar de manera precisa y persistente el último inicio y fin de sesión (login/logout tracking) de cada auxiliar o abogado.

### 4. Sistema de Auto-Guardado y Respaldo Inteligente (Cloud y Local)

Para mitigar riesgos de pérdida de información y alinearse a la Fase 3 del cronograma sobre auto-guardado y gestión offline-online, implementé rutinas avanzadas y endpoints de procesamiento en segundo plano para las copias de seguridad:

- **Backups Diarios Automatizados (Cron Jobs):** Despliegue de un servicio (`backupService.ts`) que orquesta copias periódicas de seguridad de la base de datos local SQLite y respaldos en la nube, superando el esquema obsoleto de recauchutaje de zips, promoviendo ahora rutinas transparentes para el cliente.
- **Integración Temprana a Nubes Externas (G-Drive):** Diseño de bases técnicas e integración preliminar de estrategias híbridas de almacenamiento en repositorios de Google Drive como apoyo directo al storage de Supabase tradicional, de modo que los expedientes se vuelvan altamente disponibles.
- **Gestor de Cola de Sincronización (SyncQueue):** Configuración definitiva del gestor asíncrono con estado transaccional (`pending`, `syncing`, `completed`, `failed`) para manejar el reintento de operaciones sobre la base local. Con ello, las tareas de manipulación se reanudan al haber reconexión, cumpliendo el requisito imperativo del "modo offline".

### 5. Refuerzo de Reglas de Seguridad, Validaciones Estrictas y Pruebas

Terminé el periodo consolidando los middlewares y controles de acceso en general, además de realizar las inspecciones necesarias mediante herramientas especializadas para comprobar las iteraciones de este mes.

- **Middlewares Contextuales:** Ajusté los interceptores de autorización para validar la membresía del usuario en un grupo (`GroupRole`) concurrentemente a su nivel de permiso puntual (`PermissionLevel`) en el documento en cuestión. El motor de autorización evita por completo las fugas de datos y respeta la jerarquía en los equipos.
- **Validaciones Rigurosas en el Borde (Zod):** Sistematización de validadores estrictos para protección de tipos con esquemas Zod en todas las entradas del backend para purgar e inspecionar los DTOs y paramentros de querystring y body que llegan a los endpoints.
- **Pruebas y Verificación Backend Continuas:** Validé sistemáticamente el funcionamiento de estos módulos haciendo uso extensivo de `Prisma Studio` y `Postman (Rest Clients)` e inyecciones directas desde la CLI, comprobando empíricamente la consistencia transaccional y los efectos cruzados sobre tablas cruciales como `Groups`, `SyncQueue` y `ActivityLog`.

### 6. Control de avances frente al cronograma

Mantuve el avance y el desarrollo documentado, logrando consolidar sólidamente y sin demora las metas de la Fase 2 (Colaboración total y nube) y la fase base del modo asíncrono de la Fase 3 (Edición avanzada) de la propuesta del sistema:

- Autonomía e Independencia Ofimática implementada con tablas de grupos, permisos granulares y aislamiento riguroso probados en backend.
- APIs preparadas bajo la centralización de Bitácora. Todas las acciones sensibles son debidamente reportadas y pueden ser auditadas.
- Mecanismo resiliente y modernizado de Sincronización Híbrida reforzado con automatización de Backups diarios y retenciones offline eficaces.
- Seguridad de Endpoints blindada con chequeos semánticos formales y protección basada en claims dinámicos delegados.

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

---

## C. ETAPAS CUMPLIDAS

1. Aislamiento de datos implementado, permitiendo a despachos y equipos mantener su información e integrantes de forma confidencial, operando independientemente en la plataforma.
2. Definición, migración y estabilización del modelo de base de datos colaborativo para el nivel servidor (roles de grupo, permisos rigurosos por documento y esquema de delegación/asignaciones).
3. APIs de auditoría operativas a través de la Bitácora Centralizada, resguardando en los repositorios relacionales todo evento crítico del sistema para la tabla `ActivityLog`.
4. Sistema robusto y resiliente de auto-guardado en modo offline (`SyncQueue`) y Jobs programados funcionales (Cron jobs en Node) para los backups diarios en la nube externa y almacenamiento de borde.
5. Middlewares de seguridad de Endpoints consolidados contra la manipulación, suplantación o vulneraciones, apoyados mediante validaciones nativas estrictas de TS (`Zod objects`).
6. Integración API lista y validada sistemáticamente mediante pruebas por Postman y uso de clientes ORM como Prisma Studio, previas al acople y enlace con la UI de frontend.

---

**NOMBRE Y FIRMA DEL ESTUDIANTE**

Juan Leonardo Cruz Flores

_________________________________________________
