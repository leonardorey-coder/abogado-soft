# Planeación del desarrollo en fases - Backend SIDOC

## Tu Proyecto

**Nombre de tu proyecto:**  
SIDOC: Sistema Integral de Documentos Colaborativos

**Para qué sirve tu proyecto:**  
Desarrollar la capa de soporte backend de SIDOC para garantizar el almacenamiento confiable de documentos y metadatos, el control de acceso por rol y por grupo, la sincronización entre base local y nube, y la ejecución segura de operaciones como compartir, asignar, versionar y auditar documentos. Esta capa permitirá que la aplicación funcione con integridad, seguridad y disponibilidad de la información, incluso cuando el usuario trabaje sin conexión.

---

## Fases de tu Proyecto

### Fase 1: MVP Backend

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | MVP Backend |
| **Cuándo empiezas** | 02/02/2026 |
| **Cuándo terminas** | 23/02/2026 |
| **Horas de trabajo** | 35 |

**Actividades de esta fase:**  
Configurar el proceso principal del sistema y la base técnica del backend; diseñar e implementar el esquema de base de datos local para usuarios, documentos, convenios y permisos; preparar migraciones y estructura de persistencia; desarrollar operaciones básicas para crear, consultar, actualizar y eliminar documentos y metadatos desde la integración con la interfaz; implementar autenticación inicial con servicio en la nube; habilitar almacenamiento local de archivos y su relación con los registros de base de datos.

---

### Fase 2: Grupos, permisos e integración con nube

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Grupos, permisos e integración con nube |
| **Cuándo empiezas** | 24/02/2026 |
| **Cuándo terminas** | 13/03/2026 |
| **Horas de trabajo** | 30 |

**Actividades de esta fase:**  
Diseñar el modelo de grupos; implementar permisos granulares por usuario y por grupo sobre documentos; integrar autenticación y autorización con Firebase o Supabase; configurar almacenamiento de archivos en la nube y base de datos remota; definir reglas de acceso y validaciones de seguridad; habilitar compartir y asignar documentos a usuarios desde la capa de soporte; implementar la sincronización básica de subida y descarga con marcado de operaciones pendientes cuando no haya conexión.

---

### Fase 3: Sincronización robusta

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Sincronización robusta |
| **Cuándo empiezas** | 14/03/2026 |
| **Cuándo terminas** | 28/03/2026 |
| **Horas de trabajo** | 25 |

**Actividades de esta fase:**  
Desarrollar el módulo de sincronización entre base local y nube; implementar cola de operaciones pendientes para modo offline; detectar cambios por fecha, versión o estado; definir y programar reglas para resolución de conflictos; notificar a la aplicación el estado de sincronización; incorporar historial de versiones y papelera desde backend; validar consistencia de datos durante reconexión y recuperación de errores de red.

---

### Fase 4: Convenios y funciones en la nube

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Convenios y funciones en la nube |
| **Cuándo empiezas** | 29/03/2026 |
| **Cuándo terminas** | 08/04/2026 |
| **Horas de trabajo** | 18 |

**Actividades de esta fase:**  
Implementar la persistencia y sincronización de convenios en local y nube; definir validaciones sobre fechas, estados y relaciones con documentos;  configurar copias de seguridad automáticas; añadir registro de auditoría para acciones relevantes; asegurar almacenamiento protegido de archivos y metadatos con reglas de acceso consistentes.

---

### Fase 5: Documentación técnica y cierre backend

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Documentación técnica y cierre backend |
| **Cuándo empiezas** | 09/04/2026 |
| **Cuándo terminas** | 17/04/2026 |
| **Horas de trabajo** | 12 |

**Actividades de esta fase:**  
Optimizar consultas, índices y rendimiento de la base local y servicios remotos; documentar modelo de datos, puntos de integración con la interfaz, flujo de sincronización y despliegue en la nube; realizar pruebas técnicas de recuperación ante fallos de red, consistencia de datos y carga básica; ajustar validaciones y auditoría; preparar el cierre técnico del backend para su entrega e integración estable con el resto del sistema.

---

## Información Adicional

### Actividades de Aprendizaje

Analizar los requerimientos técnicos del backend de SIDOC; diseñar el modelo de datos para usuarios, documentos, grupos, convenios y permisos; implementar la persistencia local y la integración con servicios en la nube; desarrollar mecanismos de autenticación, autorización y sincronización offline; realizar pruebas de consistencia, recuperación y seguridad; documentar la arquitectura, los flujos de integración y el despliegue técnico.

### Resultados de Aprendizaje

Aplicar conocimientos de bases de datos, desarrollo backend y seguridad para construir una capa de soporte funcional; diseñar e implementar módulos de persistencia, control de acceso y sincronización; integrar servicios en la nube con una aplicación de escritorio; documentar técnicamente un sistema real y validar su funcionamiento mediante pruebas.

### Evidencias

Código fuente del backend; esquema de base de datos y migraciones; módulo de autenticación y permisos; implementación de sincronización local-nube; funciones en la nube para convenios, alertas y auditoría; documentación técnica de arquitectura, integración y despliegue; pruebas funcionales y técnicas realizadas sobre el sistema.

### Instrumentos de Evaluación

Revisión del código fuente y estructura del proyecto; validación de entregables por fase; pruebas funcionales del backend; pruebas de sincronización, seguridad y recuperación ante fallos; documentación técnica entregada; seguimiento del cronograma y cumplimiento de objetivos específicos.

### Asignaturas

- Bases de Datos
- Desarrollo de Aplicaciones / Backend
- Redes o Sistemas Distribuidos
- Seguridad en Computación
- Ingeniería de Software

### Tópicos Recomendados

- Modelado de datos relacional
- Migraciones y persistencia local
- Autenticación y autorización
- Sincronización offline-first
- Integración con Firebase o Supabase
- Control de permisos por rol y grupo
- Auditoría y seguridad de la información
- APIs e integración backend-interfaz

### Estrategias Didácticas

Desarrollo por fases con entregas incrementales; aprendizaje basado en proyecto; implementación y validación de módulos reales del backend; pruebas continuas por cada fase; revisión de arquitectura y modelo de datos; documentación técnica progresiva; retroalimentación constante sobre funcionalidad, seguridad y consistencia de la información.
