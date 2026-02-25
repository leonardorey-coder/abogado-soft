# Evidencias: Peticiones cURL para probar la API Backend AbogadoSoft

Base URL por defecto: `http://localhost:4000`. El servidor debe estar levantado (`cd backend && bun run dev`).

Para endpoints que requieren autenticación, se usa el JWT de Supabase. Obtener el token desde el frontend (Supabase Auth) tras iniciar sesión, o con la API de Supabase Auth. En los ejemplos se usa la variable `TOKEN`.

```bash
export BASE=http://localhost:4000
export TOKEN="<pegar_aqui_el_access_token_de_supabase>"
```

---

## 1. Health check (sin autenticación)

```bash
curl -s -X GET "$BASE/api/health" | jq
```

Respuesta esperada: `{"status":"ok","runtime":"bun","version":"...","timestamp":"..."}`

---

## 2. Auth

### 2.1 Registrar usuario (después de crearlo en Supabase Auth)

```bash
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-del-usuario-supabase",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "officeName": "Oficina Ejemplo",
    "phone": "+52 1234567890",
    "role": "asistente"
  }' | jq
```

### 2.2 Sincronizar usuario (OAuth / actualizar perfil desde Supabase)

```bash
curl -s -X POST "$BASE/api/auth/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-del-usuario-supabase",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "avatarUrl": "https://ejemplo.com/avatar.png"
  }' | jq
```

### 2.3 Obtener perfil del usuario autenticado

```bash
curl -s -X GET "$BASE/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 2.4 Actualizar perfil (PATCH)

```bash
curl -s -X PATCH "$BASE/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Nombre Actualizado", "phone": "+52 9876543210"}' | jq
```

### 2.5 Cerrar sesión (registro en bitácora)

```bash
curl -s -X POST "$BASE/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 3. Usuarios

### 3.1 Listar usuarios (paginado)

```bash
curl -s -X GET "$BASE/api/users?page=1&limit=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 3.2 Obtener usuario por ID

```bash
curl -s -X GET "$BASE/api/users/<USER_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 4. Expedientes (Cases)

### 4.1 Listar expedientes

```bash
curl -s -X GET "$BASE/api/cases?page=1&limit=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Con filtros opcionales:

```bash
curl -s -X GET "$BASE/api/cases?page=1&limit=20&status=en_proceso&search=2024&caseType=civil" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4.2 Obtener expediente por ID

```bash
curl -s -X GET "$BASE/api/cases/<CASE_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4.3 Crear expediente (solo admin)

```bash
curl -s -X POST "$BASE/api/cases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "EXP-2024-001",
    "title": "Ejemplo de expediente",
    "client": "Cliente Ejemplo S.A.",
    "court": "Juzgado Primero",
    "caseType": "civil",
    "status": "en_proceso",
    "description": "Descripción del caso",
    "startDate": "2024-01-15",
    "endDate": null
  }' | jq
```

### 4.4 Actualizar expediente (solo admin)

```bash
curl -s -X PATCH "$BASE/api/cases/<CASE_UUID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resuelto", "endDate": "2024-06-01"}' | jq
```

### 4.5 Eliminar expediente (solo admin)

```bash
curl -s -X DELETE "$BASE/api/cases/<CASE_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 5. Documentos

### 5.1 Listar documentos

```bash
curl -s -X GET "$BASE/api/documents?page=1&limit=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Con filtros:

```bash
curl -s -X GET "$BASE/api/documents?page=1&limit=20&type=pdf&status=ACTIVO&groupId=<GROUP_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5.2 Obtener documento por ID

```bash
curl -s -X GET "$BASE/api/documents/<DOCUMENT_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5.3 Papelera (documentos eliminados)

```bash
curl -s -X GET "$BASE/api/documents/trash?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5.4 Subir archivo (multipart)

```bash
curl -s -X POST "$BASE/api/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/ruta/al/archivo.pdf" \
  -F "name=Mi documento" \
  -F "description=Descripción opcional" \
  -F "groupId=<GROUP_UUID>" \
  -F "caseId=<CASE_UUID>" | jq
```

---

## 6. Grupos

### 6.1 Listar grupos del usuario

```bash
curl -s -X GET "$BASE/api/groups?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 6.2 Obtener grupo por ID

```bash
curl -s -X GET "$BASE/api/groups/<GROUP_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 6.3 Crear grupo

```bash
curl -s -X POST "$BASE/api/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Grupo Evidencia", "description": "Grupo para pruebas"}' | jq
```

### 6.4 Unirse a grupo por código de invitación

```bash
curl -s -X POST "$BASE/api/groups/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inviteCode": "CODIGO12"}' | jq
```

---

## 7. Convenios

### 7.1 Listar convenios

```bash
curl -s -X GET "$BASE/api/convenios?page=1&limit=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Con filtros:

```bash
curl -s -X GET "$BASE/api/convenios?page=1&limit=20&estado=activo&search=2024" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 7.2 Obtener convenio por ID

```bash
curl -s -X GET "$BASE/api/convenios/<CONVENIO_UUID>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 7.3 Crear convenio (solo admin)

```bash
curl -s -X POST "$BASE/api/convenios" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "numero": "CONV-2024-01",
    "institucion": "Institución Ejemplo",
    "departamento": "Legal",
    "descripcion": "Convenio de colaboración",
    "fechaInicio": "2024-01-01",
    "fechaFin": "2025-12-31",
    "estado": "activo",
    "monto": 100000
  }' | jq
```

### 7.4 Actualizar convenio (solo admin)

```bash
curl -s -X PATCH "$BASE/api/convenios/<CONVENIO_UUID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"estado": "vencido"}' | jq
```

---

## 8. Actividad (bitácora)

### 8.1 Listar actividad

```bash
curl -s -X GET "$BASE/api/activity?page=1&limit=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Con filtros (admin puede filtrar por userId):

```bash
curl -s -X GET "$BASE/api/activity?page=1&limit=20&activity=CASE_CREATED&entityType=case" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8.2 Estadísticas de actividad (solo admin)

```bash
curl -s -X GET "$BASE/api/activity/stats" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 9. Notificaciones

### 9.1 Listar notificaciones

```bash
curl -s -X GET "$BASE/api/notifications?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 9.2 Marcar notificación como leída

```bash
curl -s -X PATCH "$BASE/api/notifications/<NOTIFICATION_UUID>/read" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 9.3 Marcar todas como leídas

```bash
curl -s -X POST "$BASE/api/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 10. Asignaciones

### 10.1 Listar asignaciones del usuario

```bash
curl -s -X GET "$BASE/api/assignments?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Cómo obtener el token para las evidencias

1. Iniciar sesión en la aplicación web (frontend) que usa Supabase Auth.
2. En las DevTools del navegador (Application / Storage), o en la respuesta de login de Supabase, copiar el `access_token` (JWT).
3. Exportar en la terminal: `export TOKEN="eyJhbGc..."`.

Alternativa con Supabase Auth API (si tienes email/contraseña de prueba):

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"tu@email.com\",\"password\":\"tupassword\"}" | jq -r '.access_token'
```

Asignar ese valor a `TOKEN` y usarlo en los curls de arriba.

---

## Resumen para evidencia

| Recurso      | GET (listar) | GET (por id) | POST | PATCH | DELETE |
|-------------|--------------|--------------|------|-------|--------|
| /api/health | X            | -            | -    | -     | -      |
| /api/auth   | /me          | -            | register, sync, logout | /me | - |
| /api/users  | /            | /:id         | -    | -     | -      |
| /api/cases  | /            | /:id         | / (admin) | /:id (admin) | /:id (admin) |
| /api/documents | /         | /:id         | /upload | /:id | /:id   |
| /api/groups | /            | /:id         | /, /join | /:id | /:id   |
| /api/convenios | /          | /:id         | / (admin) | /:id (admin) | /:id (admin) |
| /api/activity | /          | -            | -    | -     | -      |
| /api/notifications | /     | -            | /read-all | /:id/read | - |
| /api/assignments | /        | -            | -    | -     | -      |

Todos los endpoints excepto `/api/health`, `/api/auth/register` y `/api/auth/sync` requieren cabecera `Authorization: Bearer <token>`.
