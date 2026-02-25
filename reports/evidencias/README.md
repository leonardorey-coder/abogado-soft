# Evidencias para REPORTE_01 (Backend AbogadoSoft)

Capturas de pantalla para la sección B del reporte. Generar y guardar en esta carpeta con los nombres indicados.

## Prisma Studio (tablas)

1. Desde la raíz del proyecto:
   ```bash
   cd backend && bunx prisma studio
   ```
2. Abrir en el navegador: http://localhost:5555
3. Tomar capturas y guardar como:
   - **prisma-studio-tablas.png** — Vista principal con el listado de modelos (Users, Documents, Groups, etc.)
   - **prisma-studio-users.png** — Tabla `users` abierta (columnas y filas de ejemplo)
   - **prisma-studio-documents.png** — Tabla `documents` abierta

## API (Postman o similar)

- **api-auth.png** — Petición a `/api/auth` (login o verificación de token)
- **api-documents.png** — Petición a `/api/documents` (listado o CRUD)

## Otros

- **estructura-backend.png** — Árbol de carpetas de `backend/` (p. ej. desde el explorador de archivos o IDE)
- **env-anonimizado.png** — Contenido de `.env` con valores sensibles ocultados (solo nombres de variables y formato)
