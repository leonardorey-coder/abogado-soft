# Contenido para Propuesta de Proyecto de Estancia 2026 - AbogadoSoft

Texto redactado según el PRD_AbogadoSoft.md para copiar en el documento Word "Propuesta de proyecto de estancia 2026.docx".

---

## DEFINICIÓN DEL PROYECTO

### Planteamiento del Problema

Los abogados de la universidad necesitan gestionar documentos (contratos, demandas, convenios) de forma colaborativa y segura, con acceso desde sus equipos y sincronización con una nube institucional. Actualmente no existe una herramienta unificada que reúna: (1) gestión documental colaborativa con permisos por grupos, (2) sincronización automática nube-local, (3) gestión de convenios universidad-abogados con soporte tipo Excel, y (4) una interfaz pensada para usuarios no técnicos y personas mayores (accesibilidad, botones grandes, texto legible, flujos simples).

Los aspectos centrales del problema son: la dispersión de archivos, la falta de control de versiones y permisos, la dificultad para dar seguimiento a convenios y sus vencimientos, y la barrera de usabilidad para perfiles senior. Las relaciones entre estos elementos exigen una solución de escritorio (Electron) con backend en nube (Firebase/Supabase), base de datos local (SQLite) y diseño UX/UI accesible.

---

### Objetivos

**Objetivo general**

Desarrollar AbogadoSoft: una aplicación de escritorio (Electron + React) que permita a los abogados universitarios gestionar documentos de forma colaborativa en una nube privada, con sincronización automática, gestión de convenios y una interfaz extremadamente amigable y accesible.

**Objetivos específicos**

1. Implementar el CRUD de documentos (crear, leer, actualizar, eliminar) con visualización y edición embebida para formatos DOCX, PDF, XLSX y TXT.
2. Diseñar e implementar un sistema de grupos con permisos granulares (lectura, escritura, administrador) e invitación por código o correo institucional.
3. Integrar sincronización automática entre copia local (SQLite) y nube (Firebase/Supabase), con auto-guardado y modo offline.
4. Desarrollar el módulo de convenios universidad-abogados con importación/exportación Excel, estados (activo, pendiente, vencido) y alertas de vencimiento.
5. Aplicar principios de accesibilidad (botones mínimos 48x48px, texto 16px+, alto contraste, iconos con texto, navegación por teclado y soporte para lectores de pantalla).

---

### Alcances y entregables finales

**Alcances**

- Plataforma: aplicación de escritorio con Electron 28+, frontend React 18 + TypeScript, SPA con React Router.
- Usuarios objetivo: abogados senior, abogados junior y personal administrativo de la universidad.
- Documentos: gestión de DOCX, PDF, XLSX, TXT/RTF con editor embebido, historial de versiones (últimas 10) y papelera con recuperación 30 días.
- Compartir y asignados: modal de compartir documento (copiar enlace, compartir con el sistema operativo, asignar a usuario de la app) y página "Asignados" en el header con estadísticas (pendientes, revisados, activos, total), filtros y listado en tarjetas de los documentos asignados al usuario. Permisos sobre documentos (Lectura, Escritura, Admin) visibles en tarjetas; acceso completo al documento para auxiliares mediante contraseña o PIN de administrador (por sesión).
- Convenios: registro de número, institución, fechas de vigencia, responsable, estado y documentos adjuntos; filtros por estado y año; reportes básicos.
- Sincronización: almacenamiento local con SQLite, sincronización con Firebase/Supabase, edición offline con sincronización al reconectar.

**Entregables finales**

1. Aplicación AbogadoSoft instalable (Windows/macOS) con autenticación, CRUD de documentos, grupos, permisos, sincronización nube/local, compartir documento (enlace, share del SO, asignación a usuario) y vista Asignados con estadísticas y filtros.
2. Módulo de convenios con listado, filtros, importar/exportar Excel y alertas de vencimiento.
3. Editor embebido para DOCX, PDF, XLSX y TXT con auto-guardado e historial de versiones.
4. Documentación técnica y manual de usuario; instalador y mecanismo de actualizaciones automáticas.

---

### Metodología de desarrollo

Se utilizará un enfoque ágil iterativo (similar a Scrum) con fases cortas y entregables incrementales, alineado al roadmap del PRD:

- **Fase 1 (MVP, 4-6 semanas):** setup Electron + React + TypeScript, autenticación, CRUD documentos, visualización básica, SQLite y UI accesible.
- **Fase 2 (Colaboración, 3-4 semanas):** grupos, permisos, sincronización con nube, notificaciones.
- **Fase 3 (Edición avanzada, 3-4 semanas):** editor DOCX embebido, anotaciones PDF, historial de versiones, auto-guardado.
- **Fase 4 (Convenios, 2-3 semanas):** módulo convenios, Excel, alertas y reportes.
- **Fase 5 (Polish, 2 semanas):** onboarding, atajos, modo offline robusto, actualizaciones automáticas.

**Justificación:** La metodología ágil permite ajustar requisitos con el asesor empresarial (Rectoría/Abogado General) y con usuarios piloto; las iteraciones cortas reducen riesgo y facilitan la validación temprana de usabilidad y accesibilidad, críticas para el perfil de abogados senior. El PRD ya define un roadmap por fases, lo que encaja con sprints y entregables verificables en cada etapa de la estancia.

---

### Cronograma de trabajo / Cronograma de actividades

| Etapa | Actividad | Mes 1 | Mes 2 | Mes 3 | Mes 4 |
|-------|-----------|:-----:|:-----:|:-----:|:-----:|
| 1. MVP | Setup Electron + React + TypeScript; autenticación; CRUD documentos; SQLite; UI base accesible | X | | | |
| 2. Colaboración | Grupos; permisos; sincronización nube (Firebase/Supabase); notificaciones | | X | | |
| 3. Edición | Editor DOCX embebido; anotaciones PDF; historial versiones; auto-guardado | | | X | |
| 4. Convenios | Módulo convenios; importar/exportar Excel; alertas vencimiento; reportes | | | | X |
| 5. Cierre | Onboarding; atajos; modo offline; actualizaciones automáticas; documentación y entrega | | | | X |

(Ajustar Mes 1–4 según duración real de la estancia.)

---

### Asignaturas y temas aplicables al proyecto (mínimo 3 asignaturas y 5 temas)

| Asignatura | Temas aplicables |
|------------|------------------|
| Ingeniería de Software | Metodologías ágiles; requisitos y PRD; diseño de interfaces de usuario (UX/UI). |
| Bases de Datos | Modelado de datos (entidades: Usuario, Documento, Grupo, Convenio); SQL y SQLite; sincronización y consistencia. |
| Desarrollo de Aplicaciones Web o Móviles | React y TypeScript; estado (Zustand); consumo de APIs; autenticación y permisos. |
| Interacción Humano-Computadora (o similar) | Accesibilidad (WCAG); diseño para adultos mayores; usabilidad y pruebas con usuarios. |
| Redes o Sistemas Distribuidos (opcional) | Sincronización cliente-servidor; modo offline; almacenamiento en nube (Firebase/Supabase). |

**Temas concretos (5):** (1) Requisitos y documentación (PRD), (2) Modelado de datos y SQLite, (3) Desarrollo de interfaces con React y accesibilidad, (4) Autenticación, permisos y grupos, (5) Sincronización nube-local y modo offline.

---

*Este contenido se generó a partir del PRD_AbogadoSoft.md para llenar la propuesta de proyecto de estancia 2026.*
