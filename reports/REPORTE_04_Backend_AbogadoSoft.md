#+------------------------------------+--------------------------------------------------+
| **Reporte de evidencias fotográficas**                                                |
+------------------------------------+--------------------------------------------------+
| Alumno:                            | Juan Leonardo Cruz Flores                        |
+------------------------------------+--------------------------------------------------+
| Matrícula:                         | 202300097                                        |
+------------------------------------+--------------------------------------------------+
| Mes:                               | Abril 2026                                       |
+------------------------------------+--------------------------------------------------+
| Proyecto                           | AbogadoSoft: plataforma de gestión documental y  |
|                                    | colaborativa para despachos jurídicos.           |
+------------------------------------+--------------------------------------------------+
| Estancia:                          | 2                                                |
+------------------------------------+--------------------------------------------------+
| **Descripción**                                                                       |
+---------------------------------------------------------------------------------------+

### 1. Desarrollo y estabilización del módulo de convenios (Fase 4)

En el último mes del periodo enfoqué el trabajo en cerrar la Fase 4 del cronograma de la propuesta 2026, correspondiente al módulo de **convenios universidad–abogados**. El objetivo fue dejar el backend listo para soportar la operación completa del módulo con filtros, estados y relación directa con documentos adjuntos, conservando el aislamiento por grupos y la trazabilidad en bitácora.

Las tareas principales fueron:

- Consolidé el **modelo de datos** de convenios (número, institución, fechas de vigencia, responsable, estado, notas y asociación con documentos).
- Diseñé y dejé operativo el conjunto de rutas de API necesarias para el flujo del módulo: creación, edición, listado con filtros y transiciones de estado.
- Integré el registro de eventos críticos del módulo en `ActivityLog`, para auditoría y trazabilidad (altas, ediciones, cambios de estado y adjuntos).

Con esto el servidor queda alineado a los objetivos específicos del proyecto (módulo tipo Excel, estados y alertas) y a lo descrito en la planeación por fases.

### 2. Importación y exportación XLSX con validaciones de consistencia

De acuerdo con el cronograma (Fase 4: importación/exportación XLSX), implementé la base del flujo para importar y exportar convenios en formato Excel, permitiendo a los usuarios trabajar con un formato familiar y acelerar la captura masiva.

Para asegurar estabilidad y calidad de datos:

- Apliqué validaciones estrictas en el borde (estructura del archivo, columnas obligatorias y tipos de dato) para evitar registros incompletos o inconsistentes.
- Definí una estrategia de importación que preserve la integridad referencial con documentos y usuarios responsables, registrando errores de fila y resultados de la operación para trazabilidad.
- Preparé el endpoint de exportación para que el frontend pueda generar reportes de convenios por filtros (año, estado, institución) y descargar un XLSX con formato consistente.

Esto permite que el módulo de convenios cumpla su objetivo operativo sin depender de procesos manuales externos y mantiene coherencia con la arquitectura ya implementada en el backend.

### 3. Alertas de vencimiento, automatización y respaldo (Fase 5 parcial)

Siguiendo el cronograma y los requisitos de seguridad y disponibilidad, incorporé automatización para alertas y respaldos, aprovechando trabajos programados para mitigar el riesgo de pérdida de información y garantizar continuidad operativa.

En este bloque:

- Integré mecanismos de **alerta por vencimiento** de convenios basados en fechas de vigencia, preparando la salida para que el frontend muestre indicadores y listados priorizados.
- Consolidé rutinas de **respaldo automático** y el soporte de respaldos en nube, manteniendo consistencia con la estrategia híbrida (local + nube) definida en meses anteriores.
- Fortalecí la trazabilidad de estos eventos (alertas y respaldos) mediante registros en bitácora cuando aplica, manteniendo evidencia técnica verificable.

Aunque estas actividades forman parte de la Fase 5 en la propuesta 2026, se avanzó de forma anticipada para estabilizar el cierre del módulo de convenios y reducir riesgos antes del despliegue final.

### 4. Refuerzo de seguridad, control de acceso y endurecimiento del API

En el cierre del periodo reforcé los controles de seguridad del backend, alineados con el alcance del proyecto (autenticación, integridad de datos y acceso controlado). El objetivo fue consolidar el acceso por rol y por grupo, además de endurecer los endpoints nuevos (convenios, importación/exportación y automatizaciones).

Las acciones fueron:

- Apliqué validaciones adicionales y controles de acceso en las rutas del módulo de convenios para impedir exposición de información entre despachos y evitar operaciones sin permisos.
- Revisé rutas sensibles para asegurar que toda operación crítica quede auditada y que los errores se devuelvan de forma consistente (sin filtrar detalles internos).
- Mantuvé la consistencia del modelo de permisos granulares y el aislamiento multi-equipo, tal como se estableció en los reportes anteriores.

Esto cierra el periodo con una base sólida para operación real, priorizando seguridad y confiabilidad del backend.

### 5. Pruebas integrales, evidencias y control de avance frente al cronograma

Para finalizar el mes y asegurar el cierre del cronograma, realicé pruebas integrales de los módulos involucrados (documentos, sincronización, bitácora y convenios). El objetivo fue verificar la coherencia end-to-end de los flujos y documentar evidencia de funcionamiento.

- Validé el funcionamiento con **Prisma Studio** (consistencia de registros y relaciones) y con clientes REST (Postman u otros) para los endpoints de convenios, importación/exportación y alertas.
- Revisé el cumplimiento frente al cronograma de la propuesta 2026, asegurando que los entregables de Fase 4 estén cubiertos y que los avances de Fase 5 (seguridad y respaldo) queden encaminados.
- Organicé evidencias fotográficas y documentación interna para mantener trazabilidad y facilitar la entrega institucional.

Con estas actividades se completa el último mes de trabajo con un backend más estable, seguro y alineado a los objetivos del proyecto.

### B. EVIDENCIAS FOTOGRÁFICAS

Las siguientes capturas se generan con **Prisma Studio** y herramientas de prueba de API (Postman u otras). Los nombres de archivo propuestos mantienen consistencia con los reportes anteriores.

1. **Prisma Studio — Tabla/Entidad de Convenios (listado y detalle)**  
   ![](evidencias/prisma-studio-convenios-listado.png)

2. **Postman — API de convenios (CRUD y filtros)**  
   ![](evidencias/api-convenios-crud-filtros.png)

3. **Postman — Importación XLSX (resultado por filas / validaciones)**  
   ![](evidencias/api-convenios-import-xlsx.png)

4. **Postman — Exportación XLSX (descarga por filtros)**  
   ![](evidencias/api-convenios-export-xlsx.png)

5. **Prisma Studio — Bitácora (ActivityLog) con eventos de convenios**  
   ![](evidencias/prisma-studio-activitylog-convenios.png)

6. **Evidencia — Alertas de vencimiento / job programado**  
   ![](evidencias/alertas-vencimiento-cron.png)

7. **Evidencia — Respaldo automático (local/nube)**  
   ![](evidencias/backups-automaticos.png)

---

### C. ETAPAS CUMPLIDAS

1. Implementación y estabilización del **módulo de convenios** en backend (modelo, rutas y auditoría), correspondiente a la Fase 4 del cronograma.
2. Base funcional de **importación y exportación XLSX** con validaciones estrictas y resultados trazables para carga masiva y reportes.
3. Integración de **alertas de vencimiento** y automatizaciones, con respaldo técnico para que el frontend muestre indicadores y listados priorizados.
4. Refuerzo de **seguridad y control de acceso** en endpoints nuevos, manteniendo aislamiento por equipos/grupos y auditoría consistente.
5. Pruebas integrales, generación de evidencias y verificación de avance frente al cronograma de la propuesta 2026 y la planeación por fases.

---

**NOMBRE Y FIRMA DEL ESTUDIANTE**

Juan Leonardo Cruz Flores

_________________________________________________

