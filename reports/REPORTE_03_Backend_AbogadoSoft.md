#+------------------------------------+--------------------------------------------------+
| **Reporte de evidencias fotográficas**                                                |
+------------------------------------+--------------------------------------------------+
| Alumno:                            | Juan Leonardo Cruz Flores                        |
+------------------------------------+--------------------------------------------------+
| Matrícula:                         | 202300097                                        |
+------------------------------------+--------------------------------------------------+
| Mes:                               | Mayo 2026 (Reporte Final)                        |
+------------------------------------+--------------------------------------------------+
| Proyecto                           | AbogadoSoft: plataforma de gestión documental y  |
|                                    | colaborativa para despachos jurídicos.           |
+------------------------------------+--------------------------------------------------+
| Estancia:                          | 2                                                |
+------------------------------------+--------------------------------------------------+
| **Descripción**                                                                       |
+---------------------------------------------------------------------------------------+

Este reporte consolida los avances correspondientes al cierre del proyecto, abordando las fases finales del backend (Fases 3, 4 y 5), la reestructuración de almacenamiento y las herramientas avanzadas integradas previo al despliegue definitivo.

### 1. Control de versiones, estados del documento y robustez Offline (Fase 3)

Se consolidó un modelo avanzado en el backend para gestionar versiones y sincronización en contextos offline:
- **Versionado e Historial:** Se implementó un esquema donde cada actualización genera un registro formal (autor, timestamp, justificación de cambio) fortaleciendo el aislamiento y seguridad.
- **Modo Offline y SyncQueue:** Se refinaron las reglas de resolución de conflictos para que el servidor integre las estrategias de "último cambio consistente". Esto permite soportar ediciones y creaciones asíncronas con persistencia temporal.
- **Preparación de API para Auto-guardado:** Se flexibilizaron los modelos de recepción para soportar autoguardados esporádicos y recuperación local (IndexedDB en frontend) garantizando integridad transaccional desde los despachos.

### 2. Implementación Integral del Módulo de Convenios (Fase 4)

El backend quedó configurado para soportar todo el ciclo de vida de los **convenios universidad-abogados**:
- Se diseñó el modelo completo en Prisma (institución, vigencias, responsable, notas, relación con documentos y bitácora en `ActivityLog`).
- Se crearon las rutas para altas, edición, listado filtrado de estados y cambios. Adicionalmente, se completó el soporte para la **Importación y Exportación XLSX**.
- **Consistencia de datos:** Se añadieron validaciones en el borde para rechazar registros mal formados desde Excel, logrando una carga masiva eficiente y exportaciones fiables por filtros.

### 3. Migración de Almacenamiento a Cloudflare R2 y Seguridad General

Se rediseñó profundamente la estrategia de infraestructura enfocada en disponibilidad y escalabilidad:
- **Cloudflare R2 (compatible AWS S3):** Se reemplazó Google Drive por un esquema de generación de *presigned URLs*. Esto ofrece descargas y cargas atómicas blindando el acceso entre despachos.
- Se extendió el esquema base en BD (`storageKey`) y se estructuró una **generación y vinculación nativa de PDFs**, enlazando los expedientes estructurales a sus impresiones portátiles sin dependencias inestables.
- Por el flanco de seguridad (Fase 5), se endurecieron todas las rutas del API para mantener aislamiento absoluto por grupos, integrando **alertas cronometradas** por vencimiento de documentos y respaldos automatizados.

### 4. Búsqueda Avanzada e Indexación con MeiliSearch

Para completar los requisitos operativos de recuperación rápida, se desarrolló el servicio `MeiliSearchProvider`:
- Integración global de un entorno *MeiliSearch*, ejecutando *scripts* de servidor como `reindex.ts` para mapear de cero a cien bases masivas.
- Incorporación de funciones de **resaltado (highlights)** en las búsquedas. Ahora, cualquier consulta al backend no sólo retorna metadatos, sino los fragmentos precisos dentro del texto documental donde hubo incidencias.

---

### B. EVIDENCIAS FOTOGRÁFICAS

Las siguientes evidencias fueron recolectadas empleando clientes REST, consolas y el explorador de la base (Prisma Studio) a lo largo del desarrollo final.

1. **Prisma Studio — Control de versiones y colas de sincronización (SyncQueue)**  
   ![](evidencias/prisma-studio-versions-syncqueue.png)

2. **Postman — Auto-guardado offline y resolución de conflictos de API**  
   ![](evidencias/api-versioning-autosave.png)

3. **Prisma Studio — Registro del Módulo Convenios con importación de datos (Validaciones y ActivityLog)**  
   ![](evidencias/prisma-studio-convenios-activitylog.png)

4. **Terminal / API — Ejecución exitosa de migración a R2 y obtención de Presigned URLs S3**  
   ![](evidencias/api-storage-presigned-urls-r2.png)

5. **Prisma Studio / Meilisearch — Vinculación de Documentos a PDFs y reindexación exitosa en el motor**  
   ![](evidencias/prisma-studio-meilisearch-pdf.png)

---

### C. ETAPAS CUMPLIDAS

1. **Robustez y Versionado:** Consolidación total de estados del documento y resolución integral offline-online integrando respuestas resilientes del servidor.
2. **Despliegue del Módulo Convenios:** Finalización con éxito de todas sus rutas, auditorías internas y conectores bidireccionales con archivos XLSX (Excel).
3. **Escalabilidad de Almacenamiento:** Transición de operaciones y archivos al servicio nativo Cloudflare R2 / S3 blindando seguridad, velocidad y esquemas en BD.
4. **Infraestructura de Búsquedas y Archivos Abiertos:** Inyección de búsquedas con resaltados por *MeiliSearch* y estandarización del control de los PDFs ligados directamente a los expedientes.
5. **Cierre y Documentación del Backend:** Realización de pruebas sistemáticas y estabilización para el soporte de auditoría continua en un entorno _Multi-Tenant_ de despachos.

---

**NOMBRE Y FIRMA DEL ESTUDIANTE**

Juan Leonardo Cruz Flores

_________________________________________________
