**PROPUESTA DE PROYECTO DE ESTANCIA**

**Fecha: 06/02/2026**

**INFORMACIÓN GENERAL DEL PROYECTO**

+----------------+----------------+----------------+-------------------+-------------------+-------------------+
|                                                                                                              |
+--------------------------------------------------+-----------------------------------------------------------+
| **Programa Educativo:**                          | Ing. En Software                                          |
+--------------------------------------------------+-----------------------------------------------------------+
| **Título del proyecto:**                         | AbogadoSoft (Backend)                                     |
+--------------------------------------------------+-----------------------------------------------------------+
| **Nombre del alumno:**                           | Cruz Flores Juan Leonardo                                 |
+----------------+---------------------------------+-------------------+-------------------+-------------------+
| **Matrícula:** | 202300097                                           | **Teléfono:**     | 9985555000        |
+----------------+----------------+------------------------------------+-------------------+-------------------+
| **Correo electrónico:**         | <202300097@upqroo.edu.mx>                                                  |
+---------------------------------+----------------------------------------------------------------------------+
| **Asesor Académico**            | Manuel Alejandro Flores Barrera                                            |
+---------------------------------+----------------------------------------------------------------------------+
| **Proceso**                     | [Estancia II]{.mark}                                                       |
+---------------------------------+----------------------------------------------------------------------------+

+------------------+-------------------+-------------------+-----------------------------+
| **Empresa donde  | Universidad Politécnica de Quintana Roo                             |
| realizará el     |                                                                     |
| proyecto:**      |                                                                     |
+------------------+---------------------------------------------------------------------+
| **Dirección:**   | Av. Arco Bincentenario, Mza. 11, Lote 1119-33 Sm 255, 77500 Cancún, |
|                  | Q.R., Cancún, México                                                |
+------------------+---------------------------------------------------------------------+
| **Asesor         | Lic. Luis Abraham Padilla Carrillo                                  |
| empresarial:**   |                                                                     |
+------------------+---------------------------------------------------------------------+
| **Cargo:**       | Abogado General                                                     |
+------------------+-------------------+-------------------+-----------------------------+
| **Teléfono:**    | 9982463069        | **Correo:**       | abogado.gral@upqroo.edu.mx  |
+------------------+-------------------+-------------------+-----------------------------+
| **Área donde se  | Rectoría (Abogado General)                                          |
| realizará el     |                                                                     |
| proyecto:**      |                                                                     |
+------------------+---------------------------------------------------------------------+

**DEFINICIÓN DEL PROYECTO**

1.  Planteamiento del Problema: exponer los aspectos, elementos y
    relaciones del problema.

+:----------------------------------------------------------------------+
| Los abogados de la universidad necesitan gestionar documentos         |
| (contratos, demandas, convenios) de forma colaborativa y segura, con  |
| acceso desde cualquiera de sus equipos y sincronización con una nube  |
| institucional con guardado automatizado para la nube y local.         |
| Actualmente no existe una herramienta unificada que reúna: gestión    |
| documental colaborativa con permisos y asignaciones por grupos,       |
| sincronización automática nube-local, gestión de convenios            |
| universidad-abogados con soporte tipo Excel, trazabilidad de los      |
| cambios colaborativos hechos en los documentos y una interfaz pensada |
| para usuarios no técnicos (accesibilidad, botones grandes, texto      |
| legible, flujos simples).                                             |
|                                                                       |
| Los aspectos centrales del problema son: la dispersión de archivos    |
| entre ubicaciones y entre su estado de edición, la falta de control   |
| de versiones, permisos y asignaciones, la dificultad para dar         |
| seguimiento a convenios y sus vencimientos, la seguridad del guardado |
| de los documentos, la edición colaborativa de los mismos y la barrera |
| de usabilidad para perfiles senior. Las relaciones entre estos        |
| elementos exigen una solución de escritorio sincronización en nube y  |
| diseño UX/UI accesible.                                               |
+-----------------------------------------------------------------------+

2.  Definir los objetivos generales y específicos.

+:----------------------------------------------------------------------+
| **General\**                                                          |
| \                                                                     |
| Desarrollar la lógica del servidor (backend) de AbogadoSoft,          |
| destinada a una aplicación de escritorio para abogados, que permita   |
| la gestión colaborativa de documentos en una nube privada mediante    |
| almacenamiento confiable de archivos y estado de edición en el equipo |
| del usuario, sincronización automática y segura con la nube, control  |
| de acceso por rol y por grupo, y ejecución robusta de las operaciones |
| del sistema, garantizando integridad, seguridad, disponibilidad y     |
| eficiencia en la gestión de la información.                           |
|                                                                       |
| **Específicos**                                                       |
|                                                                       |
| **1.** Implementar el CRUD de documentos (crear, leer, actualizar,    |
| eliminar) con visualización y edición embebida para formatos DOCX,    |
| PDF, XLSX y TXT.                                                      |
|                                                                       |
| **2.** Centralizar el almacenamiento de documentos y convenios en una |
| arquitectura unificada con consistencia nube--local.                  |
|                                                                       |
| **3.** Diseñar e implementar un sistema de grupos con permisos        |
| (lectura, escritura, administrador) e invitación por código.          |
|                                                                       |
| **4.** Diseñar el sistema de usuarios, roles (abogado, auxiliar) y    |
| grupos, con permisos granulares (lectura, escritura, administrador) y |
| asignación de archivos.                                               |
|                                                                       |
| **5.** Implementar sincronización automática bidireccional (SQLite    |
| local -- nube Firebase/Supabase) con auto-guardado, modo offline y    |
| resolución de conflictos.                                             |
|                                                                       |
| **6.** Desarrollar el módulo de convenios tipo Excel con estados      |
| (activo, pendiente, vencido), importación/exportación XLSX y alertas  |
| de vencimiento.                                                       |
|                                                                       |
| **7.** Implementar estados de documento (activo, pendiente, inactivo, |
| visto, editado) con registro automático de cambios con                |
| importación/exportación Excel, y alertas de vencimiento..             |
|                                                                       |
| **8.** Desarrollar control de versiones con historial, restauración y |
| solucionador de conflictos.                                           |
|                                                                       |
| **9.** Implementar edición colaborativa en tiempo real con control de |
| concurrencia.                                                         |
|                                                                       |
| **10.** Desarrollar bitácora de actividad (auditoría) por usuario y   |
| acción.                                                               |
|                                                                       |
| **11.** Garantizar seguridad mediante autenticación y respaldo        |
| automático.                                                           |
+-----------------------------------------------------------------------+

3.  Establecer los alcances de su proyecto y los entregables finales.
    (Metas a la que apunta)

+:----------------------------------------------------------------------+
| **Alcances**                                                          |
|                                                                       |
| 1\. Implementación de la arquitectura de almacenamiento centralizado  |
| para documentos y convenios, con sincronización nube--local.          |
|                                                                       |
| 2\. Desarrollo de los servicios API necesarios para la gestión de     |
| documentos, convenios, usuarios, roles y grupos.                      |
|                                                                       |
| 3\. Implementación de control de acceso basado en roles y permisos    |
| granulares.                                                           |
|                                                                       |
| 4\. Desarrollo del sistema de sincronización automática con soporte   |
| offline y resolución de conflictos.                                   |
|                                                                       |
| 5\. Implementación de control de versiones, bitácora de actividad y   |
| trazabilidad de cambios.                                              |
|                                                                       |
| 6\. Desarrollo del sistema de estados de documentos y convenios con   |
| alertas automáticas.                                                  |
|                                                                       |
| 7\. Implementación de edición colaborativa en tiempo real.            |
|                                                                       |
| 8\. Aplicación de mecanismos de seguridad (autenticación, cifrado e   |
| integridad de datos).                                                 |
|                                                                       |
| **Entregables finales**                                               |
|                                                                       |
| 1\. Backend funcional desplegado y documentado.                       |
|                                                                       |
| 2\. API documentada (ej. Swagger/Postman).                            |
|                                                                       |
| 3\. Base de datos estructurada (modelo entidad--relación y scripts).  |
|                                                                       |
| 4\. Sistema de sincronización nube--local operativo.                  |
|                                                                       |
| 5\. Módulo de control de versiones y bitácora funcional.              |
|                                                                       |
| 6\. Sistema de permisos por roles y grupos implementado.              |
|                                                                       |
| 7\. Módulo de gestión de convenios con importación/exportación Excel. |
|                                                                       |
| 8\. Documento técnico con arquitectura, tecnologías utilizadas y      |
| manual técnico.                                                       |
|                                                                       |
| 9\. Manual de instalación y configuración.                            |
|                                                                       |
| 10\. Pruebas funcionales documentadas                                 |
|                                                                       |
| 11\. Aplicación AbogadoSoft instalable (Windows/macOS) con            |
| autenticación, CRUD de documentos, grupos, permisos y sincronización  |
| nube/local.                                                           |
|                                                                       |
| .                                                                     |
+-----------------------------------------------------------------------+

4.  Metodología de desarrollo a utilizar (justificar el uso de la
    metodología a usar)

+:----------------------------------------------------------------------+
| **\                                                                   |
| Metodología**                                                         |
|                                                                       |
| Para el desarrollo del backend de AbogadoSoft, con una duración       |
| estimada de cuatro meses, se utilizará la metodología ágil Scrum.     |
|                                                                       |
| Fase 1 -- MVP (4--6 semanas)                                          |
|                                                                       |
| Arquitectura backend, modelado de base de datos (SQLite + nube),      |
| autenticación y CRUD de documentos con persistencia local.            |
|                                                                       |
| Fase 2 -- Colaboración (3--4 semanas)                                 |
|                                                                       |
| Roles (abogado, auxiliar), grupos, permisos granulares, estados de    |
| documento y sincronización automática nube--local.                    |
|                                                                       |
| Fase 3 -- Control y Versionado (3--4 semanas)                         |
|                                                                       |
| Auto-guardado, control de versiones, bitácora de actividad,           |
| resolución de conflictos y edición colaborativa en tiempo real.       |
|                                                                       |
| Fase 4 -- Convenios (2--3 semanas)                                    |
|                                                                       |
| Módulo de convenios tipo Excel, importación/exportación XLSX, estados |
| y alertas de vencimiento.                                             |
|                                                                       |
| Fase 5 -- Optimización (2 semanas)                                    |
|                                                                       |
| Modo offline completo, seguridad (cifrado e integridad), respaldos y  |
| documentación técnica.                                                |
|                                                                       |
| **Justificación**                                                     |
|                                                                       |
| La metodología ágil permite ajustar requisitos con el asesor          |
| empresarial (Rectoría/Abogado General) y con usuarios piloto; las     |
| iteraciones cortas reducen riesgo y facilitan la validación temprana  |
| de usabilidad y accesibilidad, críticas para el perfil de abogados    |
| senior. El PRD ya define un roadmap por fases, lo que encaja con      |
| sprints y entregables verificables en cada etapa de la estancia.      |
+-----------------------------------------------------------------------+

5.  Cronograma de trabajo

+------------------------------------------------------------------------------------------+
| Cronograma de Actividades                                                                |
|                                                                                          |
|   -------------------------------------------------------------------------------------- |
|   **Etapa**   **Actividad**                              **Mes   **Mes   **Mes   **Mes   |
|                                                          1**     2**     3**     4**     |
|   ----------- ------------------------------------------ ------- ------- ------- ------- |
|   1           Diseño de arquitectura y modelado de base  ✔                               |
|               de datos                                                                   |
|                                                                                          |
|   1           Configuración del entorno y autenticación  ✔                               |
|                                                                                          |
|   1           CRUD de documentos y almacenamiento local  ✔       ✔                       |
|               (SQLite)                                                                   |
|                                                                                          |
|   2           Gestión de usuarios, roles y grupos                ✔                       |
|                                                                                          |
|   2           Implementación de permisos granulares              ✔                       |
|                                                                                          |
|   2           Sincronización nube--local (base)                  ✔       ✔               |
|                                                                                          |
|   3           Estados de documento y control de acceso                   ✔               |
|                                                                                          |
|   3           Control de versiones y bitácora                            ✔               |
|                                                                                          |
|   3           Resolución de conflictos y auto-guardado                   ✔               |
|                                                                                          |
|   3           Edición colaborativa en tiempo real                        ✔       ✔       |
|                                                                                          |
|   4           Desarrollo módulo de convenios (tipo                               ✔       |
|               Excel)                                                                     |
|                                                                                          |
|   4           Importación/exportación XLSX y alertas                             ✔       |
|                                                                                          |
|   5           Seguridad (cifrado, integridad, respaldos)                         ✔       |
|                                                                                          |
|   5           Pruebas integrales y documentación técnica                         ✔       |
|   -------------------------------------------------------------------------------------- |
+==========================================================================================+

6.  Asignaturas y temas aplicables al proyecto (mínimo 3 asignaturas y 5
    temas)

+:----------------------------------------------------------------------+
| **1. DESARROLLO WEB (BACKEND)**                                       |
|                                                                       |
| 1\. Arquitectura en capas con Node.js y TypeScript.                   |
|                                                                       |
| 2\. Desarrollo de APIs REST para documentos, convenios y usuarios.    |
|                                                                       |
| 3\. Implementación de autenticación y control de acceso (JWT y        |
| roles).                                                               |
|                                                                       |
| 4\. Integración de WebSockets para edición colaborativa.              |
|                                                                       |
| 5\. Sincronización nube--local con resolución de conflictos.          |
|                                                                       |
| **2. BASES DE DATOS**                                                 |
|                                                                       |
| 1\. Diseño y normalización del modelo relacional.                     |
|                                                                       |
| 2\. Implementación de control de versiones y bitácora.                |
|                                                                       |
| 3\. Gestión de estados y reglas de integridad.                        |
|                                                                       |
| 4\. Uso de transacciones para consistencia de datos.                  |
|                                                                       |
| 5\. Protección y cifrado de información sensible.                     |
|                                                                       |
| **3. PROGRAMACIÓN CLIENTE--SERVIDOR**                                 |
|                                                                       |
| 1\. Comunicación REST asíncrona con manejo de JSON.                   |
|                                                                       |
| 2\. Implementación de WebSockets en tiempo real.                      |
|                                                                       |
| 3\. Validación y sanitización de datos en endpoints.                  |
|                                                                       |
| 4\. Optimización de consultas y rendimiento.                          |
|                                                                       |
| 5\. Seguridad en la comunicación (HTTPS y headers).                   |
|                                                                       |
| **4. PROGRAMACIÓN CONCURRENTE**                                       |
|                                                                       |
| 1\. Control de concurrencia en edición simultánea.                    |
|                                                                       |
| 2\. Manejo de conflictos en sincronización.                           |
|                                                                       |
| 3\. Procesamiento asíncrónico de múltiples solicitudes.               |
|                                                                       |
| 4\. Consistencia transaccional en operaciones críticas.               |
|                                                                       |
| 5\. Gestión segura de eventos en tiempo real.                         |
+-----------------------------------------------------------------------+
