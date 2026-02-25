# Contenido backend para Propuesta de Estancia 2026 – Secciones idénticas al Word

Copiar cada bloque en la sección correspondiente del documento **Propuesta de proyecto de estancia 2026.docx**.

---

## DEFINICIÓN DEL PROYECTO

---

### Planteamiento del Problema:

La aplicación AbogadoSoft requiere una capa de soporte que garantice el almacenamiento, la seguridad y la disponibilidad de la información del despacho. En la actualidad, el proyecto necesita resolver la gestión de documentos y metadatos (usuarios, grupos, convenios), el control de acceso según el rol de cada usuario (abogado o auxiliar) y la posibilidad de trabajar sin conexión y sincronizar después con la nube. Estas necesidades impactan directamente en la confiabilidad de los datos, la coordinación entre el equipo y la protección de la información sensible.

**Aspectos:**

- **Almacenamiento y disponibilidad:** Se requiere que los documentos y su información asociada se guarden de forma confiable en el equipo del usuario y que estén disponibles aunque no haya conexión a internet, evitando pérdida de datos y permitiendo continuar el trabajo en cualquier momento.

- **Control de acceso:** Debe existir un mecanismo que identifique a cada usuario (abogado o auxiliar), asigne permisos acordes a su rol y permita gestionar el acceso por grupo, de modo que solo se acceda a la información autorizada.

- **Sincronización:** Es necesario que los datos guardados localmente se mantengan alineados con una copia en la nube, de forma que los cambios realizados en un equipo o en la nube se reflejen correctamente en todos los puntos, incluso cuando se ha trabajado sin conexión.

- **Seguridad de la información:** Los documentos del despacho deben estar protegidos tanto en el equipo local como durante el envío a la nube, con registro de las acciones relevantes para poder auditar su uso.

- **Integración con la aplicación:** La interfaz de AbogadoSoft debe poder ejecutar las operaciones de gestión de documentos, grupos, convenios y permisos a través de una capa de soporte bien definida, sin exponer detalles técnicos innecesarios al usuario.

**Elementos del sistema:**

- **Usuarios y roles:** Entidades que representan a los miembros del despacho (abogado, auxiliar) con sus permisos y su relación con grupos y documentos.

- **Documentos y metadatos:** Expedientes o archivos gestionados por la aplicación, con información de estado, asignación y relación con grupos y convenios.

- **Grupos y permisos:** Conjuntos de usuarios con permisos compartidos sobre documentos, permitiendo trabajo colaborativo y control por área o caso.

- **Convenios:** Registros asociados a la actividad del despacho, con fechas y estados que pueden requerir alertas o reportes.

- **Sincronización local-nube:** Mecanismo que mantiene la coherencia entre la información guardada en el equipo y la almacenada en la nube, manejando ausencia de red y conflictos de versión.

**Relaciones:**

- Los usuarios se asocian a grupos y tienen permisos sobre documentos y convenios según su rol y asignación.

- Los documentos pueden estar asignados a usuarios o grupos y su estado (por ejemplo asignado o revisado) debe reflejarse tanto en local como en nube.

- La sincronización depende del estado de los datos locales y de la nube, de la conexión a internet y de reglas claras para resolver conflictos cuando un mismo dato se modifica en más de un lugar.

---

### Definir los objetivos generales y específicos.

**Objetivo general**

Desarrollar la capa de soporte (backend) de AbogadoSoft que permita el almacenamiento confiable de documentos y metadatos en el equipo del usuario, el control de acceso por rol y por grupo, la sincronización con la nube y la ejecución segura de las operaciones que la aplicación requiere, de modo que el despacho pueda trabajar con garantías de integridad, seguridad y disponibilidad de la información.

**Objetivos específicos**

1. Diseñar e implementar el modelo de datos que represente usuarios, documentos, grupos, convenios y permisos en una base de datos local, con soporte para consultas eficientes, historial de versiones y papelera.

2. Definir e implementar los puntos de integración entre la interfaz de la aplicación y la capa de soporte, de forma que se puedan realizar las operaciones de gestión de documentos, grupos, convenios y permisos, incluyendo compartir y asignar documentos a usuarios, con validación y registro de auditoría básico.

3. Integrar el sistema de autenticación y autorización con un servicio en la nube, de modo que el inicio de sesión, la sesión activa y las reglas de acceso (por rol y por grupo) se apliquen de forma consistente en la aplicación y en los servicios en línea.

4. Desarrollar el módulo de sincronización entre la base local y la nube: detección de cambios, cola de operaciones cuando no hay conexión, criterios para resolver conflictos y notificación al usuario del estado de sincronización.

5. Implementar en la nube las funciones necesarias para validación de convenios, alertas de vencimiento, copias de seguridad programadas y registro de auditoría, y configurar el almacenamiento de archivos con las medidas de seguridad adecuadas.

---

### Establecer los alcances de su proyecto y los entregables finales. (Metas a la que apunta)

**Alcances (backend)**

- **Proceso principal de la aplicación:** Desarrollo sobre Node.js y Electron; organización en módulos de base de datos local, sincronización e integración con la interfaz; detección de cambios en archivos locales y mecanismo de actualización automática de la aplicación.

- **Base de datos local:** Esquema que refleje usuarios, documentos, grupos, miembros, convenios y permisos; soporte para compartir y asignar documentos a usuarios, estados de asignación y revisión, borrado lógico e historial de versiones; índices para búsqueda y filtros por estado y fecha.

- **Servicios en la nube:** Uso de Firebase o Supabase para autenticación, almacenamiento de archivos y base de datos en tiempo real; funciones en la nube para validaciones, alertas y reportes.

- **Sincronización:** Guardado inmediato en local y envío asíncrono a la nube; marcado de operaciones pendientes cuando no hay conexión; sincronización al recuperar la conexión; historial de versiones (últimas 10) y papelera (30 días) soportados en backend.

- **Seguridad:** Cifrado de documentos en reposo, uso de tokens y reglas de acceso, registro de auditoría y copias de seguridad automáticas configurables.

**Entregables finales (backend)**

1. Código del proceso principal con módulos de base de datos local, sincronización e integración con la interfaz; esquema y migraciones documentados; soporte para compartir documento (enlace, asignación a usuario) y listado de documentos asignados.

2. Integración completa con Firebase o Supabase: autenticación, almacenamiento de archivos, base de datos en tiempo real y al menos dos funciones en la nube (por ejemplo alerta de vencimiento de convenios y backup o auditoría).

3. Módulo de sincronización operativo: cola offline, resolución de conflictos y notificación del estado de sincronización a la aplicación.

4. Documentación técnica de los puntos de integración, modelo de datos, flujo de sincronización y despliegue de servicios en la nube.

---

### Metodología de desarrollo a utilizar (justificar el uso de la metodología a usar)

**Metodología seleccionada:** Desarrollo ágil iterativo con fases alineadas al backend del proyecto.

**Justificación de la metodología:**

- **Entrega incremental:** Cada fase entrega un bloque funcional (persistencia local, integración con la interfaz, autenticación, sincronización, funciones en la nube), lo que permite validar con el resto del sistema desde etapas tempranas.

- **Feedback continuo:** La construcción por capas permite ajustar el modelo de datos, las reglas de sincronización y la seguridad con base en el comportamiento real de la aplicación y los usuarios.

- **Flexibilidad ante cambios:** Es posible priorizar o reordenar tareas según la aparición de conflictos de sincronización, requisitos de rendimiento o nuevas necesidades de seguridad.

- **Riesgo controlado:** Los problemas técnicos (por ejemplo rendimiento de consultas o manejo de conflictos) se detectan y abordan en la fase correspondiente.

- **Calidad integrada:** En cada fase se consideran validación, registro de auditoría y consistencia de datos.

**Estructura de fases:**

- **Fase 1 (MVP):** Configuración del proceso principal; esquema de base de datos local (usuarios, documentos, convenios); operaciones básicas de gestión vía integración con la interfaz; autenticación con servicio en la nube; almacenamiento local de archivos y metadatos.

- **Fase 2 (Colaboración):** Modelo de grupos y permisos en base local y en nube; reglas de seguridad en servicios en la nube; sincronización inicial (subida y descarga) y manejo de estado “pendiente” cuando no hay conexión.

- **Fase 3 (Sincronización robusta):** Cola de operaciones pendientes; detección de cambios por fecha o versión; resolución de conflictos; notificaciones a la aplicación; historial de versiones y papelera en backend.

- **Fase 4 (Convenios y funciones en la nube):** Persistencia y sincronización de convenios; funciones en la nube para alertas de vencimiento y reportes; copias de seguridad automáticas y auditoría.

- **Fase 5 (Cierre):** Optimización de consultas e índices; documentación de puntos de integración y flujos; pruebas de carga y de recuperación ante fallos de red.

---

### Cronograma de trabajo

---

### Cronograma de actividades

| Etapa | Actividad | Mes1 | Mes2 | Mes3 | Mes4 |
|-------|-----------|:----:|:----:|:----:|:----:|
| 1. MVP Backend | Proceso principal; base de datos local (esquema, migraciones); operaciones de gestión vía interfaz; autenticación con servicio en nube; almacenamiento local y en nube | X | | | |
| 2. Grupos y permisos | Modelo de grupos y permisos en base local y nube; reglas de seguridad; sincronización básica y cola offline | | X | | |
| 3. Sincronización | Cola de pendientes; detección de cambios; resolución de conflictos; notificaciones; versiones y papelera | | | X | |
| 4. Convenios y nube | Convenios en base local y nube; funciones en la nube (alertas, reportes, backup y auditoría) | | | | X |
| 5. Cierre Backend | Índices y optimización; documentación de integración y sincronización; pruebas de red y recuperación | | | | X |

(Ajustar Mes 1–4 según duración real de la estancia.)

---

### Asignaturas y temas aplicables al proyecto (mínimo 3 asignaturas y 5 temas)

| Asignatura | Temas aplicables |
|------------|------------------|
| Bases de Datos | Modelado relacional (usuarios, documentos, grupos, convenios, permisos); SQL y base de datos local; índices y optimización de consultas; transacciones y consistencia. |
| Redes o Sistemas Distribuidos | Sincronización cliente-servidor; colas offline; resolución de conflictos; protocolos y APIs REST y en tiempo real. |
| Seguridad en Computación (o similar) | Autenticación y autorización; tokens; cifrado en reposo y en tránsito; reglas de acceso y auditoría. |
| Desarrollo de Aplicaciones (backend) | Node.js; procesos (Electron); comunicación entre procesos; integración con servicios en la nube (Firebase/Supabase); funciones en la nube. |
| Ingeniería de Software | Requisitos no funcionales (rendimiento, disponibilidad); documentación de APIs; pruebas e integración. |

**Temas concretos (5):** (1) Modelado de datos y base de datos local (esquema, migraciones, consultas), (2) Autenticación y autorización con servicio en la nube y reglas de acceso, (3) Sincronización entre local y nube y manejo offline, (4) Puntos de integración con la aplicación y servicios en la nube (almacenamiento y base en tiempo real), (5) Funciones en la nube y seguridad (cifrado, registros, backup).
