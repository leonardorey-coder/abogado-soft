# Permisos en AbogadoSoft

Referencia según PRD, Manual Técnico y modelo de datos.

---

## 1. Permisos de usuario (rol en la aplicación)

Cada **usuario** tiene un rol que define su nivel en la aplicación:

| Rol (DB / tipos) | Perfil        | Descripción |
|------------------|---------------|-------------|
| `admin`          | Abogado       | Usuario principal: acceso completo, puede compartir, asignar y gestionar documentos. |
| `asistente`      | Auxiliar      | Usuario de apoyo: acceso según permisos por documento; puede solicitar "Acceso completo" con contraseña/PIN de administrador para obtener permisos de administrador sobre un documento por sesión. |

- En base de datos: `users.role` con `CHECK (role IN ('admin', 'asistente'))`.
- En código: se usa para mostrar u ocultar el botón **Acceso completo** en tarjetas (solo si el usuario es `asistente` y no tiene permiso `admin` sobre ese documento).

---

## 2. Permisos por documento

Cada **documento** puede tener permisos asignados por usuario (o por grupo). Los niveles son:

| Nivel (DB / tipos) | UI (badge)       | Descripción |
|--------------------|------------------|-------------|
| `none`             | Sin Acceso       | Sin acceso asignado actualmente. |
| `download`         | Puede Descargar  | Solo puede descargar archivos adjuntos. |
| `read`             | Lectura / Puede Ver | Solo consulta del documento. |
| `write`            | Escritura / Puede Editar | Consulta y edición. |
| `admin`            | Administrador    | Lectura, escritura y gestión (compartir, asignar, permisos). |

- En base de datos: `document_permissions.permission_level` puede extenderse con `'none'` y `'download'` además de `'read'`, `'write'`, `'admin'`.
- En tipos: `DocumentPermissionLevel = 'none' | 'download' | 'read' | 'write' | 'admin'` y `DocumentPermissionEntry { userName, level }`.
- En cada documento: `documentPermissions?: DocumentPermissionEntry[]` (lista de usuarios y nivel) y `currentUserPermission?: DocumentPermissionLevel` (permiso del usuario actual sobre ese documento).

En la tarjeta del documento se muestra:
- Badge "Tú: Sin Acceso | Puede Descargar | Lectura | Escritura | Administrador" según `currentUserPermission`.
- Indicador "Admin" si existe otro usuario con nivel admin en `documentPermissions`.

---

## 3. Permisos en grupos (miembros del grupo)

Dentro de un **grupo**, cada miembro tiene un rol en el grupo (no es el rol de usuario global):

| Rol en grupo (DB) | Descripción |
|-------------------|-------------|
| `admin`           | Administrador del grupo. |
| `editor`          | Editor. |
| `viewer`          | Solo lectura. |

- En base de datos: `group_members.role` con `CHECK (role IN ('admin', 'editor', 'viewer'))`.

---

## 4. Resumen de relaciones

- **Usuario** tiene un solo rol de aplicación: `admin` (abogado) o `asistente` (auxiliar).
- **Documento** tiene una lista de permisos por usuario (y opcionalmente por grupo): `none`, `download`, `read`, `write`, `admin`.
- Un **asistente** con permiso `read`, `write`, `download` o `none` sobre un documento puede usar **Acceso completo** (contraseña/PIN) para tener temporalmente permiso de tipo administrador sobre ese documento en la sesión actual.
