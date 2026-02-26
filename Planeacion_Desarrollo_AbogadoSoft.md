# Planeación del desarrollo en fases - AbogadoSoft

## Tu Proyecto

**Nombre de tu proyecto:**  
AbogadoSoft (Sistema de Gestión Documental Colaborativa para Despachos Jurídicos)

**Para qué sirve tu proyecto:**  
Crear una aplicación de escritorio (Electron + React) que permita a abogados universitarios y despachos jurídicos gestionar documentos de forma colaborativa en una nube privada: crear, editar, compartir y sincronizar documentos (DOCX, PDF, Excel), gestionar convenios universidad-abogados, y trabajar en equipo con permisos y grupos. La interfaz debe ser muy accesible para usuarios no técnicos y personas mayores (botones grandes, texto legible, flujos simples), priorizando una experiencia intuitiva y sin jerga técnica.

---

## Fases de tu Proyecto

### Fase 1: MVP - Base del sistema

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | MVP - Base del sistema |
| **Cuándo empiezas** | 25/02/2026 |
| **Cuándo terminas** | 08/04/2026 |
| **Horas de trabajo** | 160 |

**Actividades de esta fase:**  
Configurar el proyecto Electron + React + TypeScript y Vite; implementar autenticación básica (login/logout); CRUD de documentos (subir, ver lista, eliminar); visualización básica de PDF y DOCX; almacenamiento local con SQLite; UI base con componentes accesibles (botones grandes, alto contraste, iconos + texto); estructura de carpetas main/renderer/shared y navegación SPA.

---

### Fase 2: Colaboración y nube

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Colaboración y nube |
| **Cuándo empiezas** | 09/04/2026 |
| **Cuándo terminas** | 06/05/2026 |
| **Horas de trabajo** | 100 |

**Actividades de esta fase:**  
Diseñar e implementar el sistema de grupos de trabajo; definir permisos granulares (Lectura, Escritura, Admin) sobre documentos; funcionalidad de compartir documentos (enlace, asignar a usuario, share del SO); integración con backend/nube (Firebase o Supabase): autenticación, storage y sincronización; lógica de sincronización automática local-nube; notificaciones o indicadores de cambios y conflictos; página "Asignados" con filtros y estadísticas.

---

### Fase 3: Edición avanzada

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Edición avanzada |
| **Cuándo empiezas** | 07/05/2026 |
| **Cuándo terminas** | 03/06/2026 |
| **Horas de trabajo** | 100 |

**Actividades de esta fase:**  
Integrar editor DOCX embebido (OnlyOffice, Tiptap u otra solución); soporte de edición para DOCX/DOC y visualización/anotaciones para PDF; historial de versiones (últimas 10 versiones, restauración); auto-guardado inteligente (intervalo configurable, indicador de sincronización); exportar a local (DOCX, PDF) e impresión; modo offline con cola de sincronización al reconectar.

---

### Fase 4: Convenios

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Convenios |
| **Cuándo empiezas** | 04/06/2026 |
| **Cuándo terminas** | 24/06/2026 |
| **Horas de trabajo** | 60 |

**Actividades de esta fase:**  
Desarrollar el módulo de convenios universidad-abogados: modelo de datos (número, institución, fechas, responsable, estado, documentos adjuntos, notas); pantalla de listado con filtros por estado y año; formulario de alta/edición; importar y exportar Excel; alertas de vencimiento; enlace a documentos adjuntos; reportes básicos (listados, resúmenes por estado).

---

### Fase 5: Documentación y lanzamiento

| Campo | Valor |
|-------|--------|
| **Nombre de esta fase** | Documentación y lanzamiento |
| **Cuándo empiezas** | 25/06/2026 |
| **Cuándo terminas** | 08/07/2026 |
| **Horas de trabajo** | 50 |

**Actividades de esta fase:**  
Elaborar documentación de usuario (manual, tutoriales, centro de ayuda); documentación técnica y de despliegue; onboarding guiado para nuevos usuarios; atajos de teclado documentados y accesibles; reforzar modo offline (mensajes claros, reintentos); integración de actualizaciones automáticas (electron-updater); revisión de accesibilidad (teclado, ARIA, contraste, zoom); pruebas con usuarios piloto y ajustes de UX; preparación y lanzamiento de la versión inicial.

---

## Información Adicional

- **Stack:** Electron 28+, React 18, TypeScript, SQLite (local), Firebase/Supabase (nube).
- **Criterios de éxito por fase:** entregable funcional probado en entorno de desarrollo; sin bloqueos críticos para la fase siguiente.
- **Riesgos:** dependencia de editor DOCX embebido; calibrar complejidad de sincronización offline. Mitigación: prototipos tempranos y definición clara de alcance MVP por fase.
