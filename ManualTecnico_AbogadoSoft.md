# Manual Técnico - AbogadoSoft

> **Versión:** 1.0  
> **Fecha:** 27 de enero de 2026  
> **Stack:** Electron + React + Bun + TypeScript + PostgreSQL + Supabase + TailwindCSS

---

## 1. Stack Tecnológico

### Frontend (Renderer Process)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Tipado estático |
| TailwindCSS | 3.x | Estilos utility-first |
| React Router | 6.x | Navegación SPA |
| TanStack Query | 5.x | Data fetching/cache |
| Zustand | 4.x | State management |
| Lucide React | Latest | Iconografía |

### Backend (Main Process)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Electron | 28.x | Desktop runtime |
| Bun | 1.x | JavaScript runtime |
| TypeScript | 5.x | Tipado estático |
| PostgreSQL | 16.x | DB local (desarrollo) |
| Supabase | Latest | Backend cloud |

### Herramientas de Desarrollo
| Herramienta | Propósito |
|-------------|-----------|
| Vite | Bundler/Dev server |
| ESLint | Linting |
| Prettier | Formateo código |
| electron-builder | Empaquetado |

---

## 2. Estructura del Proyecto

```
abogado-soft/
├── src/
│   ├── main/                      # Electron Main Process
│   │   ├── index.ts               # Entry point
│   │   ├── preload.ts             # Preload script
│   │   ├── database/
│   │   │   ├── client.ts          # PostgreSQL client
│   │   │   ├── migrations/        # SQL migrations
│   │   │   └── seeds/             # Datos iniciales
│   │   ├── services/
│   │   │   ├── sync.service.ts    # Sincronización Supabase
│   │   │   ├── file.service.ts    # Gestión archivos
│   │   │   └── auth.service.ts    # Autenticación
│   │   └── ipc/
│   │       ├── handlers.ts        # IPC handlers
│   │       └── channels.ts        # Canal definitions
│   │
│   ├── renderer/                  # React SPA
│   │   ├── index.html
│   │   ├── main.tsx               # React entry
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   │   ├── index.tsx
│   │   │   │   └── components/
│   │   │   ├── Convenios/
│   │   │   ├── Editor/
│   │   │   └── Settings/
│   │   ├── components/
│   │   │   ├── ui/                # Componentes base
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── documents/
│   │   │   └── layout/
│   │   │       ├── Header.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── MainLayout.tsx
│   │   ├── hooks/
│   │   │   ├── useDocuments.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useSync.ts
│   │   ├── services/
│   │   │   └── api.ts             # IPC wrapper
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   └── documentsStore.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── shared/                    # Código compartido
│       ├── types/
│       │   ├── document.ts
│       │   ├── user.ts
│       │   └── convenio.ts
│       └── constants/
│           └── index.ts
│
├── supabase/
│   ├── migrations/                # Migraciones Supabase
│   └── functions/                 # Edge Functions
│
├── .env.example
├── .env.local                     # Variables desarrollo
├── bunfig.toml
├── electron-builder.json
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
└── vite.config.ts
```

---

## 3. Configuración Inicial

### 3.1 Inicializar Proyecto

```bash
# Crear proyecto
mkdir abogado-soft && cd abogado-soft
bun init

# Instalar dependencias core
bun add electron electron-builder
bun add react react-dom react-router-dom
bun add @tanstack/react-query zustand
bun add @supabase/supabase-js
bun add postgres  # Cliente PostgreSQL para Bun

# Dependencias de desarrollo
bun add -d typescript @types/react @types/react-dom
bun add -d vite @vitejs/plugin-react
bun add -d tailwindcss postcss autoprefixer
bun add -d eslint prettier
bun add -d electron-builder
```

### 3.2 package.json

```json
{
  "name": "abogado-soft",
  "version": "1.0.0",
  "description": "Sistema de Gestión Documental para Abogados",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"bun run dev:main\" \"bun run dev:renderer\"",
    "dev:main": "bun build src/main/index.ts --outdir dist/main --watch",
    "dev:renderer": "vite",
    "build": "bun run build:main && bun run build:renderer",
    "build:main": "bun build src/main/index.ts --outdir dist/main --minify",
    "build:renderer": "vite build",
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "db:migrate": "bun run src/main/database/migrate.ts",
    "db:seed": "bun run src/main/database/seed.ts"
  },
  "build": {
    "appId": "com.universidad.abogadosoft",
    "productName": "AbogadoSoft",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "mac": {
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    }
  }
}
```

### 3.3 Variables de Entorno

```bash
# .env.local (desarrollo)
NODE_ENV=development

# PostgreSQL Local
DATABASE_URL=postgresql://postgres:password@localhost:5432/abogadosoft

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# App
APP_STORAGE_PATH=~/AbogadoSoft/documents
```

### 3.4 TailwindCSS Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      fontSize: {
        // Tamaños accesibles
        'base': ['16px', '24px'],
        'lg': ['18px', '28px'],
        'xl': ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
      },
      spacing: {
        // Espaciado para botones accesibles
        '12': '48px',  // Mínimo touch target
        '16': '64px',  // Touch target ideal
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## 4. Base de Datos

### 4.1 PostgreSQL Local (Desarrollo)

```typescript
// src/main/database/client.ts
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export async function testConnection() {
  try {
    await sql`SELECT 1`
    console.log('✅ PostgreSQL connected')
    return true
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error)
    return false
  }
}
```

### 4.2 Esquema de Base de Datos

```sql
-- src/main/database/migrations/001_initial_schema.sql

-- Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'abogado' CHECK (role IN ('admin', 'abogado', 'asistente')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grupos
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Miembros de Grupos
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Documentos
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('docx', 'pdf', 'xlsx', 'txt', 'rtf')),
    size BIGINT NOT NULL,
    local_path TEXT,
    cloud_url TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    checksum VARCHAR(64),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos de Documentos
CREATE TABLE document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'read' CHECK (permission_level IN ('read', 'write', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)
);

-- Versiones de Documentos
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    local_path TEXT,
    cloud_url TEXT,
    size BIGINT NOT NULL,
    checksum VARCHAR(64),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convenios
CREATE TABLE convenios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(100) UNIQUE NOT NULL,
    institucion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    responsable_id UUID REFERENCES users(id),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('activo', 'pendiente', 'vencido', 'cancelado')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos de Convenios (relación N:M)
CREATE TABLE convenio_documents (
    convenio_id UUID REFERENCES convenios(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (convenio_id, document_id)
);

-- Cola de Sincronización
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_group ON documents(group_id);
CREATE INDEX idx_documents_deleted ON documents(is_deleted);
CREATE INDEX idx_convenios_estado ON convenios(estado);
CREATE INDEX idx_convenios_fecha_fin ON convenios(fecha_fin);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
```

### 4.3 Supabase (Nube)

```typescript
// src/main/services/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Storage para archivos
export const storage = supabase.storage.from('documents')
```

```sql
-- supabase/migrations/001_create_tables.sql
-- (Mismo schema que PostgreSQL local, Supabase lo gestiona)

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
ON documents FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can view group documents"
ON documents FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM group_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own documents"
ON documents FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own documents"
ON documents FOR UPDATE
USING (auth.uid() = owner_id);

-- Storage Policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 5. Servicios Core

### 5.1 Servicio de Sincronización

```typescript
// src/main/services/sync.service.ts
import { sql } from '../database/client'
import { supabase, storage } from './supabase'
import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

interface SyncEvent {
  entityType: 'document' | 'convenio' | 'group'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload?: Record<string, unknown>
}

class SyncService {
  private syncInterval: Timer | null = null
  private isOnline = true

  async start() {
    // Check connectivity
    this.checkConnectivity()
    
    // Start sync interval (every 30 seconds)
    this.syncInterval = setInterval(() => this.processSyncQueue(), 30000)
    
    // Initial sync
    await this.processSyncQueue()
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }

  private async checkConnectivity() {
    try {
      const { error } = await supabase.from('users').select('id').limit(1)
      this.isOnline = !error
    } catch {
      this.isOnline = false
    }
  }

  // Agregar a cola de sincronización
  async queueSync(event: SyncEvent) {
    await sql`
      INSERT INTO sync_queue (entity_type, entity_id, operation, payload)
      VALUES (${event.entityType}, ${event.entityId}, ${event.operation}, ${JSON.stringify(event.payload)})
    `
  }

  // Procesar cola pendiente
  async processSyncQueue() {
    if (!this.isOnline) {
      console.log('⏳ Offline - sync skipped')
      return
    }

    const pending = await sql`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 50
    `

    for (const item of pending) {
      try {
        await sql`UPDATE sync_queue SET status = 'syncing' WHERE id = ${item.id}`
        
        await this.syncItem(item)
        
        await sql`
          UPDATE sync_queue 
          SET status = 'completed', synced_at = NOW() 
          WHERE id = ${item.id}
        `
      } catch (error) {
        await sql`
          UPDATE sync_queue 
          SET status = 'failed', attempts = attempts + 1, last_error = ${String(error)}
          WHERE id = ${item.id}
        `
      }
    }
  }

  private async syncItem(item: { entity_type: string; entity_id: string; operation: string; payload: unknown }) {
    switch (item.entity_type) {
      case 'document':
        await this.syncDocument(item)
        break
      case 'convenio':
        await this.syncConvenio(item)
        break
    }
  }

  private async syncDocument(item: any) {
    const { operation, entity_id, payload } = item

    if (operation === 'create' || operation === 'update') {
      // Upload file to Supabase Storage
      const doc = payload as { local_path: string; name: string }
      const fileContent = await readFile(doc.local_path)
      
      const { data, error } = await storage.upload(
        `${entity_id}/${doc.name}`,
        fileContent,
        { upsert: true }
      )

      if (error) throw error

      // Update cloud URL in Supabase DB
      const { publicUrl } = storage.getPublicUrl(data.path).data
      
      await supabase.from('documents').upsert({
        id: entity_id,
        ...payload,
        cloud_url: publicUrl,
      })

      // Update local record with cloud URL
      await sql`
        UPDATE documents SET cloud_url = ${publicUrl} WHERE id = ${entity_id}
      `
    }

    if (operation === 'delete') {
      await storage.remove([`${entity_id}`])
      await supabase.from('documents').delete().eq('id', entity_id)
    }
  }

  private async syncConvenio(item: any) {
    const { operation, entity_id, payload } = item

    if (operation === 'delete') {
      await supabase.from('convenios').delete().eq('id', entity_id)
    } else {
      await supabase.from('convenios').upsert({ id: entity_id, ...payload })
    }
  }

  // Descargar cambios desde la nube
  async pullFromCloud() {
    const { data: cloudDocs } = await supabase
      .from('documents')
      .select('*')
      .order('updated_at', { ascending: false })

    for (const cloudDoc of cloudDocs || []) {
      const [localDoc] = await sql`
        SELECT * FROM documents WHERE id = ${cloudDoc.id}
      `

      // Si no existe local o la nube es más nueva
      if (!localDoc || new Date(cloudDoc.updated_at) > new Date(localDoc.updated_at)) {
        // Descargar archivo
        if (cloudDoc.cloud_url) {
          const response = await fetch(cloudDoc.cloud_url)
          const buffer = await response.arrayBuffer()
          
          const localPath = join(process.env.APP_STORAGE_PATH!, cloudDoc.name)
          await mkdir(join(process.env.APP_STORAGE_PATH!), { recursive: true })
          await writeFile(localPath, Buffer.from(buffer))
          
          cloudDoc.local_path = localPath
        }

        // Upsert en local
        await sql`
          INSERT INTO documents ${sql(cloudDoc)}
          ON CONFLICT (id) DO UPDATE SET ${sql(cloudDoc)}
        `
      }
    }
  }
}

export const syncService = new SyncService()
```

### 5.2 Servicio de Documentos

```typescript
// src/main/services/document.service.ts
import { sql } from '../database/client'
import { syncService } from './sync.service'
import { createHash } from 'crypto'
import { readFile, writeFile, unlink, copyFile } from 'fs/promises'
import { join, extname } from 'path'
import type { Document } from '@/shared/types/document'

class DocumentService {
  private storagePath = process.env.APP_STORAGE_PATH!

  async create(file: { name: string; path: string; type: string }, ownerId: string, groupId?: string): Promise<Document> {
    const content = await readFile(file.path)
    const checksum = createHash('sha256').update(content).digest('hex')
    const size = content.length
    const type = extname(file.name).slice(1) as Document['type']

    // Copiar a storage local
    const localPath = join(this.storagePath, file.name)
    await copyFile(file.path, localPath)

    const [doc] = await sql<Document[]>`
      INSERT INTO documents (name, type, size, local_path, owner_id, group_id, checksum)
      VALUES (${file.name}, ${type}, ${size}, ${localPath}, ${ownerId}, ${groupId}, ${checksum})
      RETURNING *
    `

    // Queue sync to cloud
    await syncService.queueSync({
      entityType: 'document',
      entityId: doc.id,
      operation: 'create',
      payload: { ...doc },
    })

    return doc
  }

  async getAll(userId: string): Promise<Document[]> {
    return sql<Document[]>`
      SELECT d.* FROM documents d
      LEFT JOIN document_permissions dp ON d.id = dp.document_id
      LEFT JOIN group_members gm ON d.group_id = gm.group_id
      WHERE d.is_deleted = false
        AND (
          d.owner_id = ${userId}
          OR dp.user_id = ${userId}
          OR gm.user_id = ${userId}
        )
      ORDER BY d.updated_at DESC
    `
  }

  async getById(id: string): Promise<Document | null> {
    const [doc] = await sql<Document[]>`
      SELECT * FROM documents WHERE id = ${id} AND is_deleted = false
    `
    return doc || null
  }

  async update(id: string, updates: Partial<Document>): Promise<Document> {
    const [doc] = await sql<Document[]>`
      UPDATE documents 
      SET ${sql(updates)}, updated_at = NOW(), version = version + 1
      WHERE id = ${id}
      RETURNING *
    `

    await syncService.queueSync({
      entityType: 'document',
      entityId: id,
      operation: 'update',
      payload: { ...doc },
    })

    return doc
  }

  async softDelete(id: string): Promise<void> {
    await sql`
      UPDATE documents 
      SET is_deleted = true, deleted_at = NOW()
      WHERE id = ${id}
    `

    await syncService.queueSync({
      entityType: 'document',
      entityId: id,
      operation: 'delete',
    })
  }

  async saveVersion(id: string, userId: string): Promise<void> {
    const doc = await this.getById(id)
    if (!doc) throw new Error('Document not found')

    const content = await readFile(doc.local_path!)
    const checksum = createHash('sha256').update(content).digest('hex')

    await sql`
      INSERT INTO document_versions (document_id, version, local_path, size, checksum, created_by)
      VALUES (${id}, ${doc.version}, ${doc.local_path}, ${doc.size}, ${checksum}, ${userId})
    `
  }

  async extractToLocal(id: string, destPath: string): Promise<string> {
    const doc = await this.getById(id)
    if (!doc || !doc.local_path) throw new Error('Document not found')

    await copyFile(doc.local_path, destPath)
    return destPath
  }
}

export const documentService = new DocumentService()
```

### 5.3 Servicio de Autenticación

```typescript
// src/main/services/auth.service.ts
import { sql } from '../database/client'
import { supabase } from './supabase'
import { hash, verify } from '@node-rs/bcrypt'
import type { User } from '@/shared/types/user'

class AuthService {
  private currentUser: User | null = null

  async login(email: string, password: string): Promise<User> {
    // Auth with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw new Error('Credenciales inválidas')

    // Get user from local DB or create
    let [user] = await sql<User[]>`
      SELECT * FROM users WHERE email = ${email}
    `

    if (!user) {
      [user] = await sql<User[]>`
        INSERT INTO users (id, email, name)
        VALUES (${data.user.id}, ${email}, ${data.user.user_metadata.name || email})
        RETURNING *
      `
    }

    // Update last login
    await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`

    this.currentUser = user
    return user
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut()
    this.currentUser = null
  }

  async register(email: string, password: string, name: string): Promise<User> {
    // Register with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (error) throw new Error(error.message)

    // Create local user
    const [user] = await sql<User[]>`
      INSERT INTO users (id, email, name)
      VALUES (${data.user!.id}, ${email}, ${name})
      RETURNING *
    `

    return user
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  async refreshSession(): Promise<void> {
    const { data } = await supabase.auth.getSession()
    
    if (data.session) {
      const [user] = await sql<User[]>`
        SELECT * FROM users WHERE id = ${data.session.user.id}
      `
      this.currentUser = user || null
    }
  }
}

export const authService = new AuthService()
```

---

## 6. IPC Communication

### 6.1 Definición de Canales

```typescript
// src/main/ipc/channels.ts
export const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_REGISTER: 'auth:register',
  AUTH_GET_USER: 'auth:get-user',

  // Documents
  DOCS_GET_ALL: 'docs:get-all',
  DOCS_GET_ONE: 'docs:get-one',
  DOCS_CREATE: 'docs:create',
  DOCS_UPDATE: 'docs:update',
  DOCS_DELETE: 'docs:delete',
  DOCS_EXTRACT: 'docs:extract',
  DOCS_OPEN_FILE: 'docs:open-file',

  // Convenios
  CONV_GET_ALL: 'conv:get-all',
  CONV_GET_ONE: 'conv:get-one',
  CONV_CREATE: 'conv:create',
  CONV_UPDATE: 'conv:update',
  CONV_DELETE: 'conv:delete',
  CONV_EXPORT_EXCEL: 'conv:export-excel',

  // Sync
  SYNC_STATUS: 'sync:status',
  SYNC_FORCE: 'sync:force',

  // Files
  FILES_OPEN_DIALOG: 'files:open-dialog',
  FILES_SAVE_DIALOG: 'files:save-dialog',
} as const
```

### 6.2 Handlers IPC

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, dialog, shell } from 'electron'
import { IPC_CHANNELS } from './channels'
import { authService } from '../services/auth.service'
import { documentService } from '../services/document.service'
import { syncService } from '../services/sync.service'

export function registerIpcHandlers() {
  // Auth Handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_, email: string, password: string) => {
    return authService.login(email, password)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    return authService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (_, email: string, password: string, name: string) => {
    return authService.register(email, password, name)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_USER, async () => {
    return authService.getCurrentUser()
  })

  // Document Handlers
  ipcMain.handle(IPC_CHANNELS.DOCS_GET_ALL, async () => {
    const user = authService.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    return documentService.getAll(user.id)
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_GET_ONE, async (_, id: string) => {
    return documentService.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_CREATE, async (_, file: { name: string; path: string; type: string }, groupId?: string) => {
    const user = authService.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    return documentService.create(file, user.id, groupId)
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_UPDATE, async (_, id: string, updates: any) => {
    return documentService.update(id, updates)
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_DELETE, async (_, id: string) => {
    return documentService.softDelete(id)
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_EXTRACT, async (_, id: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Guardar documento',
      defaultPath: '~/Downloads',
    })
    
    if (!result.canceled && result.filePath) {
      return documentService.extractToLocal(id, result.filePath)
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.DOCS_OPEN_FILE, async (_, path: string) => {
    return shell.openPath(path)
  })

  // File Dialog Handlers
  ipcMain.handle(IPC_CHANNELS.FILES_OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documentos', extensions: ['docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt'] },
      ],
    })
    return result.filePaths
  })

  // Sync Handlers
  ipcMain.handle(IPC_CHANNELS.SYNC_FORCE, async () => {
    await syncService.processSyncQueue()
    await syncService.pullFromCloud()
  })
}
```

### 6.3 Preload Script

```typescript
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from './ipc/channels'

const api = {
  auth: {
    login: (email: string, password: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, email, password),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    register: (email: string, password: string, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, email, password, name),
    getUser: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_USER),
  },
  documents: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.DOCS_GET_ALL),
    getOne: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_GET_ONE, id),
    create: (file: any, groupId?: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.DOCS_CREATE, file, groupId),
    update: (id: string, updates: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCS_UPDATE, id, updates),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_DELETE, id),
    extract: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_EXTRACT, id),
    openFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.DOCS_OPEN_FILE, path),
  },
  files: {
    openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.FILES_OPEN_DIALOG),
  },
  sync: {
    force: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_FORCE),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Types
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
```

---

## 7. Frontend React

### 7.1 Componentes UI Accesibles

```tsx
// src/renderer/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/renderer/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'lg', icon, loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
      danger: 'bg-danger text-white hover:bg-red-700 focus:ring-danger',
      ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    }

    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-11 px-4 text-base',
      lg: 'h-14 px-6 text-lg',      // 56px - accesible
      xl: 'h-16 px-8 text-xl',      // 64px - muy accesible
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-3 rounded-xl font-medium',
          'transition-all duration-200 ease-in-out',
          'focus:outline-none focus:ring-4 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-w-[120px]', // Ancho mínimo para touch targets
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    )
  }
)
```

```tsx
// src/renderer/components/ui/Card.tsx
import { type ReactNode } from 'react'
import { cn } from '@/renderer/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl p-6 shadow-sm border border-gray-100',
        'transition-all duration-200',
        hover && 'cursor-pointer hover:shadow-md hover:border-primary-200 hover:-translate-y-1',
        onClick && 'cursor-pointer',
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}
```

### 7.2 Hook de Documentos

```tsx
// src/renderer/hooks/useDocuments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Document } from '@/shared/types/document'

export function useDocuments() {
  const queryClient = useQueryClient()

  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () => window.electronAPI.documents.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: { file: any; groupId?: string }) =>
      window.electronAPI.documents.create(data.file, data.groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Document> }) =>
      window.electronAPI.documents.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI.documents.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
```

### 7.3 Página Home

```tsx
// src/renderer/pages/Home/index.tsx
import { useState } from 'react'
import { FilePlus, Upload, Search, FileText, FileSpreadsheet, File } from 'lucide-react'
import { Button } from '@/renderer/components/ui/Button'
import { Card } from '@/renderer/components/ui/Card'
import { useDocuments } from '@/renderer/hooks/useDocuments'
import { DocumentCard } from './components/DocumentCard'
import { UploadModal } from './components/UploadModal'

export function HomePage() {
  const { documents, isLoading, create, isCreating } = useDocuments()
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')

  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleUpload = async () => {
    const paths = await window.electronAPI.files.openDialog()
    if (paths.length > 0) {
      for (const path of paths) {
        const name = path.split('/').pop()!
        create({ file: { name, path, type: name.split('.').pop()! } })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Mis Documentos
        </h1>
        <p className="text-lg text-gray-600">
          Gestiona y comparte tus archivos de forma segura
        </p>
      </header>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 mb-8">
        <Button 
          icon={<FilePlus className="h-6 w-6" />}
          onClick={() => setShowUpload(true)}
        >
          Nuevo Documento
        </Button>
        
        <Button 
          variant="secondary"
          icon={<Upload className="h-6 w-6" />}
          onClick={handleUpload}
          loading={isCreating}
        >
          Subir Archivo
        </Button>

        {/* Search */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-14 pr-4 text-lg rounded-xl border border-gray-200 
                         focus:border-primary-500 focus:ring-4 focus:ring-primary-100 
                         transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg text-gray-600">Cargando documentos...</p>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="text-center py-16">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No hay documentos
          </h3>
          <p className="text-gray-600 mb-6">
            Sube tu primer documento o crea uno nuevo
          </p>
          <Button onClick={handleUpload}>
            Subir Archivo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}
```

---

## 8. Comandos de Desarrollo

```bash
# Desarrollo
bun run dev                  # Inicia Electron + Vite

# Build
bun run build               # Compila todo el proyecto
bun run dist                # Genera instalador

# Base de datos
bun run db:migrate          # Ejecuta migraciones
bun run db:seed             # Datos de prueba

# Testing
bun test                    # Ejecuta tests
bun test --watch            # Watch mode

# Linting
bun run lint                # ESLint
bun run format              # Prettier
```

---

## 9. Deployment

### 9.1 Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar migraciones SQL
3. Configurar Storage buckets
4. Configurar RLS policies
5. Obtener API keys

### 9.2 Build para Distribución

```bash
# macOS
bun run dist --mac

# Windows  
bun run dist --win

# Linux
bun run dist --linux
```

### 9.3 Auto-actualizaciones

```typescript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater'

export function initAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify()
  
  autoUpdater.on('update-downloaded', () => {
    // Notificar al usuario
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: 'Se descargó una nueva versión. ¿Reiniciar ahora?',
      buttons: ['Reiniciar', 'Después']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
}
```

---

> [!TIP]
> Para desarrollo local, asegúrate de tener PostgreSQL 16 corriendo en `localhost:5432` antes de iniciar la aplicación.
