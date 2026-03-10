#+------------------------------------+--------------------------------------------------+
| **Reporte de evidencias fotográficas**                                                |
+------------------------------------+--------------------------------------------------+
| Alumno:                            | Juan Leonardo Cruz Flores                        |
+------------------------------------+--------------------------------------------------+
| Matrícula:                         | 202300097                                        |
+------------------------------------+--------------------------------------------------+
| Mes:                               | Marzo 2026                                       |
+------------------------------------+--------------------------------------------------+
| Proyecto                           | AbogadoSoft: plataforma de gestión documental y  |
|                                    | colaborativa para despachos jurídicos.           |
+------------------------------------+--------------------------------------------------+
| Estancia:                          | 2                                                |
+------------------------------------+--------------------------------------------------+
| **Descripción**                                                                       |
+---------------------------------------------------------------------------------------+

### 1. Consolidación de control de versiones y estados de documento (Fase 3)

Durante este periodo enfoqué el trabajo en avanzar y consolidar la Fase 3 del cronograma descrito en la propuesta 2026 y en la planeación general del proyecto. El objetivo central fue robustecer el control de versiones y los estados de los documentos en el backend, asegurando que cada cambio realizado desde los distintos clientes (modo online u offline) quede trazado de forma confiable.

Tomando como base el modelo previo de `SyncQueue` y de bitácora (`ActivityLog`), extendí la capa de dominio para gestionar versiones formales de los documentos. Para ello:

- Definí un esquema de **versionado por documento** donde cada actualización importante genera un registro histórico con metadatos: autor, marca de tiempo, razón del cambio y estado del documento previo/posterior.
- Integré los **estados de documento** (activo, pendiente, inactivo, visto, editado, revisado) con las operaciones del backend, de forma que el servidor sea la fuente de verdad y no solo la interfaz.
- Alineé estos estados con los objetivos de la Fase 3 del cronograma: control de acceso reforzado, trazabilidad de cambios y preparación para edición avanzada.

Con esto se sientan las bases para que en la capa de presentación (Electron/React) sea posible mostrar un historial claro de cada expediente y permitir restauraciones puntuales sin pérdida de información.

### 2. Fortalecimiento del modo offline y resolución de conflictos

En continuidad con la Fase 3 del cronograma (resolución de conflictos y auto-guardado), reforcé la lógica de sincronización nube–local y la cola `SyncQueue` diseñada en el periodo anterior. El foco fue que la experiencia offline sea robusta incluso ante conexiones inestables o ediciones concurrentes entre varios miembros del equipo.

Entre las actividades realizadas:

- Implementé **reglas de resolución de conflictos** en el backend, priorizando una estrategia de "último cambio consistente" con apoyo en marcas de tiempo, usuario responsable y versión base del documento.
- Ajusté los estados de la cola `SyncQueue` para reflejar con más precisión los escenarios reales (creación concurrente, actualizaciones encadenadas y eliminaciones lógicas).
- Incorporé validaciones extra en las rutas implicadas (documentos, asignaciones y actividad) para garantizar que, en caso de conflicto, se registren los eventos en `ActivityLog` y se ofrezcan caminos claros de resolución al frontend.

De esta forma, el servidor mantiene la coherencia entre las copias locales y la nube sin depender exclusivamente de la lógica del cliente, cumpliendo con lo planeado en la Fase 3 de la propuesta 2026.

### 3. Preparación del backend para edición avanzada y auto-guardado

Otra línea de trabajo fue preparar al backend para integrarse con un editor avanzado de documentos (DOCX/PDF) en la aplicación de escritorio, tal como se describe en la Fase 3 ("Edición avanzada") de la planeación general de AbogadoSoft.

Para ello:

- Definí los **endpoints y contratos** necesarios para que el cliente pueda solicitar versiones específicas del documento, comparar cambios y solicitar restauraciones.
- Incorporé **puntos de auto-guardado** en la API, de forma que las operaciones de guardado periódico queden registradas con menor granularidad pero con suficiente contexto para auditoría.
- Aseguré que las operaciones intensivas (historial, restauración, comparación simplificada) se ejecuten respetando la integridad transaccional en la base de datos y el aislamiento entre despachos/grupos definido en reportes anteriores.

Con este trabajo el backend queda listo para recibir los eventos de edición avanzada desde el editor embebido, alineando el desarrollo práctico con las actividades marcadas en la Fase 3 del cronograma.

### 4. Avance del módulo de convenios (inicio Fase 4)

En paralelo al cierre de actividades de la Fase 3, inicié el desarrollo backend del módulo de convenios, correspondiente a la Fase 4 del cronograma descrito en la propuesta 2026 y en la Planeación de Desarrollo de AbogadoSoft.

Las tareas principales fueron:

- **Modelo de datos de convenios:** definición de entidades y relaciones para manejar número de convenio, institución, fechas de vigencia, responsable, estado (activo, pendiente, vencido), documentos adjuntos y notas.
- Diseño y boceto de rutas principales para el API de convenios, en consistencia con el resto de módulos: listado con filtros, alta/edición, cambio de estado y vinculación con documentos ya existentes.
- Preparación de la base técnica para **importación y exportación tipo Excel**, alineada al objetivo de ofrecer a los abogados una interfaz familiar y reportes claros.

Este trabajo conecta directamente con los objetivos específicos 6 y 7 de la propuesta 2026, asegurando que el backend soporte los futuros desarrollos de interfaz para la gestión de convenios con alertas de vencimiento.

### 5. Validaciones, pruebas integrales y control de avance frente al cronograma

Finalmente, dediqué parte del periodo a validar el funcionamiento integrado de las piezas nuevas con las que ya existían en el backend, y a revisar el avance contra el cronograma de la propuesta 2026 y la planeación por fases.

- Reforcé **validaciones de entrada** en los endpoints críticos (versionado, sincronización, convenios) para mantener la calidad de datos y reducir la probabilidad de inconsistencias.
- Ejecuté pruebas manuales apoyándome en herramientas como **Prisma Studio** y clientes REST (Postman), verificando la correcta interacción entre `Documents`, `SyncQueue`, `ActivityLog` y las nuevas entidades relacionadas con convenios.
- Revisé el avance de las fases 2, 3 y el arranque de la 4, actualizando notas y documentación interna para mantener sincronizados los documentos de planeación con el estado real del backend.

Con estas actividades, el proyecto se mantiene alineado con los objetivos generales y específicos marcados en la propuesta de estancia, preparando el terreno técnico para las etapas finales de optimización, seguridad y documentación.

### B. EVIDENCIAS FOTOGRÁFICAS

Las siguientes capturas se generan con **Prisma Studio** y herramientas de prueba de API (Postman u otras). Las rutas y nombres de archivo se mantienen consistentes con los reportes previos, siguiendo las indicaciones del README de evidencias.

1. **Prisma Studio — Historial de versiones de documentos**  
   ![](evidencias/prisma-studio-document-versions.png)

2. **Prisma Studio — Estados de documentos y cola de sincronización (SyncQueue)**  
   ![](evidencias/prisma-studio-states-syncqueue.png)

3. **Prisma Studio — Entidad ActivityLog con registros de conflictos y restauraciones**  
   ![](evidencias/prisma-studio-activitylog-versioning.png)

4. **Postman — Endpoints de versionado y auto-guardado de documentos**  
   *(Captura de una secuencia de llamadas que muestran creación de versión, auto-guardado y restauración.)*  
   ![](evidencias/api-versioning-autosave.png)

5. **Prisma Studio — Modelo inicial de convenios**  
   ![](evidencias/prisma-studio-convenios.png)

6. **Postman — API de convenios (listado y creación)**  
   ![](evidencias/api-convenios.png)

---

### C. ETAPAS CUMPLIDAS

1. Consolidación del modelo de **control de versiones y estados de documento** en el backend, alineado con la Fase 3 del cronograma.
2. Fortalecimiento del **modo offline y la resolución de conflictos** entre copias locales y la nube, integrando la cola `SyncQueue` con la bitácora de actividad.
3. Preparación de la API para **edición avanzada y auto-guardado**, definiendo contratos claros para historial, restauración y puntos de guardado periódico.
4. Arranque del **módulo de convenios** en el backend, incluyendo modelo de datos y diseño preliminar de rutas para listado, alta/edición y estados.
5. Validaciones adicionales, pruebas integrales con Prisma Studio y clientes REST, y revisión del avance frente al cronograma de la propuesta 2026 y la planeación por fases.

---

**NOMBRE Y FIRMA DEL ESTUDIANTE**

Juan Leonardo Cruz Flores

_________________________________________________

