# Análisis: Orientar la propuesta de estancia 2026 solo a desarrollo backend

## Contenido actual del documento Word

El archivo **Propuesta de proyecto de estancia 2026.docx** es una plantilla institucional que incluye:

- **Datos generales:** Programa (Ing. en Software), título del proyecto (AbogadoSoft), alumno, asesor académico, empresa (UPQROO), asesor empresarial, área (Rectoría).
- **Estructura de definición del proyecto:** Planteamiento del problema, Objetivos generales y específicos, Alcances y entregables, Metodología, Cronograma (Etapa/Actividad/Mes 1–4), Asignaturas y temas aplicables.

Las secciones de “Definición del proyecto” están solo con las instrucciones de la plantilla (ej. “exponer los aspectos, elementos y relaciones del problema”), no con el texto técnico de AbogadoSoft. Por tanto, hay que rellenar esas secciones con contenido enfocado **únicamente en backend**.

---

## Criterios para orientar la propuesta solo a backend

1. **Excluir explícitamente del alcance:** Interfaz de usuario (React/Electron renderer), diseño visual, UX, componentes de frontend. La propuesta no debe comprometer entregables de pantallas ni flujos de UI.
2. **Centrar el alcance en:** Proceso principal de Electron (main process), base de datos local (SQLite), IPC, sincronización con nube (Firebase/Supabase), autenticación/autorización, lógica serverless (Cloud Functions), seguridad y persistencia.
3. **Redacción:** Usar sujetos como “la capa de backend”, “el main process”, “el módulo de sincronización”, “las APIs IPC”, “la base de datos local”, “Cloud Functions”, evitando comprometer “la aplicación” o “la interfaz” como entregable del proyecto de estancia.
4. **Entregables:** Código del main process, esquema y migraciones SQLite, handlers IPC, integración Auth/Storage/Firestore, módulo de sincronización, Cloud Functions, documentación de APIs y flujos de sincronización. No incluir mockups ni descripción de pantallas como entregables.

---

## Cómo rellenar el documento Word

En el repositorio ya existe el archivo **Contenido_Propuesta_Estancia_AbogadoSoft_BACKEND.md**, que contiene texto listo para copiar en el Word, ya orientado a backend:

| Sección en el Word | Origen del texto |
|-------------------|------------------|
| Planteamiento del Problema | Apartado “Planteamiento del Problema” (DEFINICIÓN DEL PROYECTO – BACKEND) |
| Objetivos generales y específicos | Apartado “Objetivos” |
| Alcances y entregables finales | Apartados “Alcances (backend)” y “Entregables finales (backend)” |
| Metodología (y justificación) | Apartado “Metodología de desarrollo” |
| Cronograma de actividades | Tabla “Cronograma de trabajo / Cronograma de actividades (Backend)” |
| Asignaturas y temas (mín. 3 y 5) | Tabla “Asignaturas y temas aplicables al proyecto (Backend)” y “Temas concretos (5)” |

**Pasos recomendados:**

1. Abrir **Propuesta de proyecto de estancia 2026.docx**.
2. Abrir **Contenido_Propuesta_Estancia_AbogadoSoft_BACKEND.md** (desde la raíz del repo o desde `estancias2/` si se copia ahí).
3. Sustituir en el Word cada bloque de “instrucciones” de la plantilla por el texto correspondiente del markdown, según la tabla anterior.
4. Revisar que en todo el documento no queden referencias a “desarrollo frontend” o “interfaz” como objetivo o entregable de la estancia.

---

## Resumen de enfoque backend en la propuesta

- **Problema:** Backend de AbogadoSoft: persistencia local (SQLite), autenticación/autorización, sincronización nube-local, exposición segura vía IPC y APIs en la nube.
- **Objetivo general:** Diseñar e implementar esa capa de backend (main process, SQLite, IPC, Firebase/Supabase, Cloud Functions), con persistencia offline, consistencia y seguridad.
- **Entregables:** Código main process (database, sync, ipc), esquema y migraciones, integración Auth/Storage/Firestore, al menos dos Cloud Functions, módulo de sincronización con cola offline y resolución de conflictos, documentación técnica de APIs IPC y flujo de sincronización.
- **Metodología:** Ágil iterativo en fases (MVP backend → Grupos/permisos → Sincronización robusta → Convenios y serverless → Cierre/optimización y documentación).
- **Asignaturas/temas:** Bases de Datos, Redes/Sistemas Distribuidos, Seguridad, Desarrollo de Aplicaciones (backend), Ingeniería de Software, con los 5 temas concretos indicados en el markdown.

Con esto, la propuesta queda orientada de forma explícita y coherente **solo al desarrollo backend** del proyecto AbogadoSoft.
