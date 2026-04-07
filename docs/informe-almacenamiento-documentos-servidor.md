# Informe: almacenamiento de documentos en servidor vs. modelo objetivo

**Fecha:** 2026-04-03  
**Tipo:** hallazgo de arquitectura / deuda técnica  
**Severidad:** alta (privacidad, cumplimiento, coste de infraestructura y alineación con el producto)

## Resumen ejecutivo

Hoy el backend **persiste archivos de usuario en el disco del servidor** (carpeta `uploads/` bajo el directorio de trabajo del proceso Node). El modelo de producto deseado es distinto: los binarios **no deben residir en el servidor**; solo deben existir en **(1) el dispositivo del cliente**, en las rutas que el usuario o la app definan localmente, y **(2) Google Drive** asociado al despacho de la cuenta autenticada.

La implementación actual contradice ese modelo y concentra datos sensibles en la máquina que ejecuta la API.

## Modelo objetivo (requisito)

| Ubicación | Rol |
|-----------|-----|
| **Local del cliente** | Copia de trabajo; rutas elegidas o gestionadas en el dispositivo del usuario (escritorio, app de escritorio, PWA con almacenamiento del navegador según plataforma, etc.). |
| **Google Drive del despacho** | Copia en nube vinculada a la identidad/cuenta del usuario (OAuth del despacho ya contemplado en el producto). |
| **Servidor (API + base de datos)** | Metadatos, permisos, índices de búsqueda si aplica, identificadores de Drive (`driveFileId`, revisiones), **sin** almacenar el archivo como blob en disco propio del servidor de forma habitual. |

## Estado actual (problema)

### 1. Subida vía API escribe en disco del servidor

El flujo `POST /api/documents/upload` usa **Multer** con `diskStorage`, destino fijo:

- Directorio: `path.join(process.cwd(), 'uploads')`
- Nombre de archivo generado en servidor (`timestamp` + aleatorio + extensión)
- En base de datos se guarda `localPath` apuntando a la ruta absoluta del archivo en el servidor

**Archivo:** `backend/src/routes/documents.routes.ts` (configuración `multer.diskStorage` y handler de `/upload`).

### 2. Descarga, lectura y versiones asumen ficheros en el servidor

Varias rutas leen el contenido con `fs.readFileSync`, `res.sendFile`, `res.download` o comparan versiones usando rutas del filesystem del **servidor**, no del cliente.

**Archivo:** `backend/src/routes/documents.routes.ts` (funciones que usan `doc.localPath`, `resolveFilePath`, versiones con `localPath`, etc.).

### 3. PDFs adjuntos también en servidor

Existe lógica que guarda PDFs bajo `uploads/pdfs` (misma familia de problema).

**Archivo:** `backend/src/routes/documents.routes.ts` (referencias a `uploads/pdfs`).

### 4. Sincronización con Google Drive aún usa carpeta local en el servidor

El módulo de Drive documenta una arquitectura tipo “cliente guarda → backend sube a Drive”, pero el código mantiene **`UPLOADS_DIR`** y en flujos de sync puede **escribir** en disco del servidor (`writeFileSync` bajo `uploads`).

**Archivo:** `backend/src/routes/drive.routes.ts` (`UPLOADS_DIR`, escritura local en sync).

### 5. Copias de seguridad incluyen la carpeta `uploads`

El servicio de backup comprime explícitamente el directorio `uploads` junto al volcado de base de datos, reforzando que el servidor se trata como repositorio de archivos.

**Archivo:** `backend/src/lib/backupService.ts`.

### 6. Búsqueda / indexación

Scripts y servicios que extraen texto asumen un `localPath` resoluble en el entorno del servidor (por ejemplo `process.cwd()` o ruta absoluta en el host de la API).

**Ejemplos:** `backend/src/services/search/textExtractor.ts`, `backend/src/scripts/reindex.ts`.

### 7. Esquema de datos

El modelo `Document` (y versiones) prevé `localPath` y `cloudUrl` / campos de Drive; `localPath` hoy se usa de forma coherente con “archivo en el servidor”, no con “ruta solo en el cliente”.

**Archivo:** `backend/prisma/schema.prisma` (modelo `Document` y relaciones).

## Impacto

- **Privacidad y cumplimiento:** el servidor actúa como custodio de documentos legales; si el producto promete “solo local + Drive del despacho”, el comportamiento actual es incorrecto y puede generar obligaciones (protección de datos, localización de datos, DPA) no deseadas.
- **Escalado y despliegue:** entornos efímeros (contenedores, serverless, múltiples réplicas) no son adecuados para disco local de subidas sin un volumen compartido; hoy se asume filesystem mutable en un solo host.
- **Backups:** los ZIP mezclan metadatos/BD con contenido que, en el modelo objetivo, no debería originarse en el servidor.
- **Coherencia de producto:** el cliente no controla la ruta real del archivo en su organización; la “ruta lógica” o física debería vivir en el cliente o en Drive, no en `uploads/` del backend.

## Dirección de solución (sin implementar en este informe)

1. **Subida:** eliminar persistencia en disco del servidor; opciones típicas: el cliente sube **directamente a Drive** (SDK en cliente con token de corta duración / flujo seguro) o envía el archivo **en memoria/stream** al backend **solo** para reenvío inmediato a Drive sin guardar en disco (o con temp efímero y borrado garantizado).
2. **Metadatos en BD:** almacenar `driveFileId`, revisiones, nombres visibles, permisos; para “local del cliente”, identificadores opacos o rutas que el **cliente** persiste (IndexedDB, preferencias de app nativa, etc.), no rutas del servidor.
3. **Descarga/edición:** el servidor no sirve el archivo desde su disco; el cliente obtiene el binario desde Drive o desde su filesystem local según el flujo.
4. **Búsqueda:** indexar texto en cliente, en un servicio que lea desde Drive con consentimiento, o vía API de Drive según política del producto; no depender de `localPath` en el host de la API.
5. **Backups:** limitar a BD (y configuración); no incluir `uploads/` si deja de existir como almacén de verdad.
6. **Migración:** definir qué hacer con `localPath` existentes en bases ya desplegadas (exportar a Drive, entrega al cliente, o eliminación tras ventana de transición).

## Conclusión

El comportamiento actual **sí guarda documentos en el servidor** (`uploads/`, rutas absolutas en `localPath`, backups que incluyen esas carpetas). Eso **no cumple** el modelo requerido: archivos **solo** en el dispositivo del cliente (rutas definidas allí) y en **Google Drive del despacho** del usuario logueado, sin repositorio de archivos en el backend.

Este documento sirve como registro del desvío y como base para planificar el refactor (API, cliente, esquema y operaciones).
