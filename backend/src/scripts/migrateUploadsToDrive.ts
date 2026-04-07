// =============================================================================
// migrateUploadsToDrive.ts — Migra archivos locales (uploads/) a Google Drive
//
// Uso:  cd backend && bun src/scripts/migrateUploadsToDrive.ts [opciones]
//
// Qué hace:
//   1. Migra Documents con localPath != null y driveFileId = null  → crea en Drive
//   2. Migra DocumentVersions con localPath != null y cloudUrl = null → crea en Drive
//   3. Actualiza la base de datos con el driveFileId / cloudUrl obtenido
//   4. NO borra archivos locales (usa --delete-after para borrar)
//
// El Service Account (SA) actúa como Editor en las carpetas destino.
// El owner del archivo creado y la cuota pertenecen al propietario de la carpeta,
// no al SA. Ver: GOOGLE_DRIVE_FOLDER_DOCUMENTS y GOOGLE_DRIVE_FOLDER_CONTRACTS.
//
// Opciones:
//   --dry-run        Solo muestra qué migraría, sin subir ni modificar nada
//   --delete-after   Borra el archivo de disco después de subir exitosamente
//   --only-docs      Solo migra Documents (omite versiones)
//   --only-versions  Solo migra DocumentVersions (omite documentos)
// =============================================================================

import fs from 'fs';
import path from 'path';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env) || process.env[key] === '') process.env[key] = val;
    }
    break;
  }
}
loadEnv();

import prisma from '../lib/prisma.js';
import { uploadFile, verifyCredentials } from '../lib/googleDrive.js';

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN       = args.includes('--dry-run');
const DELETE_AFTER  = args.includes('--delete-after');
const ONLY_DOCS     = args.includes('--only-docs');
const ONLY_VERSIONS = args.includes('--only-versions');

// ─── Carpetas destino ─────────────────────────────────────────────────────────
const FOLDER_DOCS      = process.env.GOOGLE_DRIVE_FOLDER_DOCUMENTS;
const FOLDER_CONTRACTS = process.env.GOOGLE_DRIVE_FOLDER_CONTRACTS;

if (!FOLDER_DOCS || !FOLDER_CONTRACTS) {
  console.error('❌  Falta configurar GOOGLE_DRIVE_FOLDER_DOCUMENTS y/o GOOGLE_DRIVE_FOLDER_CONTRACTS en .env');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function getMimeType(type: string): string {
  const map: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    pdf:  'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:  'application/vnd.ms-excel',
    txt:  'text/plain',
    rtf:  'application/rtf',
  };
  return map[type.toLowerCase()] ?? 'application/octet-stream';
}

function resolveLocalPath(localPath: string): string | null {
  if (path.isAbsolute(localPath) && fs.existsSync(localPath)) return localPath;
  const rel = path.resolve(process.cwd(), localPath);
  if (fs.existsSync(rel)) return rel;
  return null;
}

// ─── Contadores ───────────────────────────────────────────────────────────────
const stats = {
  docsTotal: 0, docsOk: 0, docsSkipped: 0, docsError: 0,
  verTotal: 0,  verOk: 0,  verSkipped: 0,  verError: 0,
};

// =============================================================================
// MIGRACIÓN DE DOCUMENTOS
// =============================================================================
async function migrateDocs() {
  console.log('\n📄  Migrando Documents…');
  const t = Date.now();

  const docs = await prisma.document.findMany({
    where:  { localPath: { not: null }, driveFileId: null, isDeleted: false },
    select: { id: true, name: true, type: true, localPath: true, mimeType: true },
    orderBy: { createdAt: 'asc' },
  });

  stats.docsTotal = docs.length;
  console.log(`    ${docs.length} documentos sin driveFileId encontrados`);
  if (DRY_RUN) console.log('    [DRY-RUN] No se sube nada\n');

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const lp = resolveLocalPath(doc.localPath!);
    const label = `[${i + 1}/${docs.length}] ${doc.name}`;

    if (!lp) {
      console.warn(`    ⚠️  ${label} — archivo no encontrado en disco: ${doc.localPath}`);
      stats.docsSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`    ○ ${label}`);
      stats.docsOk++;
      continue;
    }

    try {
      const buffer   = fs.readFileSync(lp);
      const mimeType = doc.mimeType ?? getMimeType(doc.type);
      const hasExt   = doc.name.toLowerCase().endsWith(`.${doc.type.toLowerCase()}`);
      const driveName = hasExt ? doc.name : `${doc.name}.${doc.type}`;

      // Determina carpeta: documentos de convenio → CONTRACTS, resto → DOCS
      const convenioCount = await prisma.convenioDocument.count({ where: { documentId: doc.id } });
      const folderId = convenioCount > 0 ? FOLDER_CONTRACTS! : FOLDER_DOCS!;

      const result = await uploadFile(driveName, mimeType, buffer, folderId);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          driveFileId:     result.driveFileId,
          driveRevisionId: result.driveRevisionId,
          lastSyncAt:      new Date(),
          syncStatus:      'completed',
        },
      });

      if (DELETE_AFTER) {
        try { fs.unlinkSync(lp); } catch { /* ignorar */ }
      }

      stats.docsOk++;
      console.log(`    ✅ ${label}`);
    } catch (err) {
      stats.docsError++;
      console.error(`    ❌ ${label}: ${(err as Error).message}`);
    }
  }

  console.log(`\n    Completado: ${stats.docsOk} ok, ${stats.docsSkipped} sin archivo en disco, ${stats.docsError} errores — ${formatMs(Date.now() - t)}`);
}

// =============================================================================
// MIGRACIÓN DE VERSIONES
// =============================================================================
async function migrateVersions() {
  console.log('\n🗂️   Migrando DocumentVersions…');
  const t = Date.now();

  const versions = await prisma.documentVersion.findMany({
    where:  { localPath: { not: null }, cloudUrl: null },
    select: {
      id: true, version: true, localPath: true,
      document: { select: { id: true, name: true, type: true, mimeType: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  stats.verTotal = versions.length;
  console.log(`    ${versions.length} versiones sin cloudUrl encontradas`);
  if (DRY_RUN) console.log('    [DRY-RUN] No se sube nada\n');

  for (let i = 0; i < versions.length; i++) {
    const ver   = versions[i];
    const lp    = resolveLocalPath(ver.localPath!);
    const label = `[${i + 1}/${versions.length}] ${ver.document.name} v${ver.version}`;

    if (!lp) {
      console.warn(`    ⚠️  ${label} — archivo no encontrado: ${ver.localPath}`);
      stats.verSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`    ○ ${label}`);
      stats.verOk++;
      continue;
    }

    try {
      const buffer    = fs.readFileSync(lp);
      const mimeType  = ver.document.mimeType ?? getMimeType(ver.document.type);
      const driveName = `${ver.document.name}_v${ver.version}.${ver.document.type}`;

      const result = await uploadFile(driveName, mimeType, buffer, FOLDER_DOCS!);

      // En DocumentVersion, cloudUrl almacena el driveFileId (naming legacy)
      await prisma.documentVersion.update({
        where: { id: ver.id },
        data:  { cloudUrl: result.driveFileId },
      });

      if (DELETE_AFTER) {
        try { fs.unlinkSync(lp); } catch { /* ignorar */ }
      }

      stats.verOk++;
      console.log(`    ✅ ${label}`);
    } catch (err) {
      stats.verError++;
      console.error(`    ❌ ${label}: ${(err as Error).message}`);
    }
  }

  console.log(`\n    Completado: ${stats.verOk} ok, ${stats.verSkipped} sin archivo en disco, ${stats.verError} errores — ${formatMs(Date.now() - t)}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('\n🚀  AbogadoSoft — Migración uploads/ → Google Drive');
  console.log(`    Modo: ${DRY_RUN ? 'DRY-RUN (sin cambios)' : 'REAL'}`);
  if (DELETE_AFTER) console.log('    ⚠️  --delete-after: borrará archivos de disco tras cada subida exitosa');
  console.log('═'.repeat(52));

  const driveOk = await verifyCredentials().catch(() => false);
  console.log(`    Drive SA: ${driveOk ? '✅ conectado' : '❌ sin conexión'}`);

  if (!driveOk && !DRY_RUN) {
    console.error('\n❌  No se puede conectar a Google Drive. Verifica GOOGLE_SERVICE_ACCOUNT_PATH en .env');
    process.exit(1);
  }

  console.log(`    Carpeta docs:      ${FOLDER_DOCS}`);
  console.log(`    Carpeta contratos: ${FOLDER_CONTRACTS}`);

  const globalStart = Date.now();

  if (!ONLY_VERSIONS) await migrateDocs();
  if (!ONLY_DOCS)     await migrateVersions();

  console.log('\n' + '═'.repeat(52));
  console.log('📊  Resumen global:');
  console.log(`    Documentos : ${stats.docsOk} migrados, ${stats.docsSkipped} sin archivo, ${stats.docsError} errores (de ${stats.docsTotal})`);
  console.log(`    Versiones  : ${stats.verOk} migradas, ${stats.verSkipped} sin archivo, ${stats.verError} errores (de ${stats.verTotal})`);
  console.log(`✨  Total en ${formatMs(Date.now() - globalStart)}`);

  if (stats.docsError + stats.verError > 0) {
    console.log('\n⚠️  Hubo errores. El script es idempotente: vuelve a ejecutar para reintentar.');
  }
  if (!DELETE_AFTER && !DRY_RUN && (stats.docsOk + stats.verOk) > 0) {
    console.log('\n💡  Archivos locales NO borrados. Usa --delete-after una vez verificada la migración.');
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Error fatal:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
