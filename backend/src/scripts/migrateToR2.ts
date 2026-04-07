#!/usr/bin/env bun
// =============================================================================
// migrateToR2.ts — Script de migración de archivos históricos a Cloudflare R2
//
// Prioridad de origen:
//   1. driveFileId (Google Drive) → descarga y sube a R2
//   2. localPath (disco)          → lee del disco y sube a R2
//
// Idempotente: salta documentos que ya tienen storageKey.
//
// Uso:
//   bun run backend/src/scripts/migrateToR2.ts
//   bun run backend/src/scripts/migrateToR2.ts --dry-run
//   bun run backend/src/scripts/migrateToR2.ts --batch-size 10
// =============================================================================

import fs from 'fs';
import path from 'path';

// Carga variables de entorno desde .env (mismo patrón que otros scripts)
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
import { getStorageProvider, docKey, versionKey, pdfKey } from '../lib/storage/index.js';
import { downloadDocumentBufferSafe } from '../lib/storage/downloadHelper.js';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE_ARG = process.argv.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = BATCH_SIZE_ARG ? parseInt(BATCH_SIZE_ARG.split('=')[1], 10) : 20;

// Inicializado en main() para garantizar que loadEnv() ya corrió
let storage: ReturnType<typeof getStorageProvider>;

const stats = {
  docs: { ok: 0, skipped: 0, failed: 0 },
  versions: { ok: 0, skipped: 0, failed: 0 },
  pdfs: { ok: 0, skipped: 0, failed: 0 },
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── 1. Migrar documentos ─────────────────────────────────────────────────────
async function migrateDocuments() {
  log('=== Migrando documentos ===');

  const docs = await prisma.document.findMany({
    where: {
      storageKey: null,                         // No migrados aún
      OR: [
        { driveFileId: { not: null } },         // Tiene Drive
        { localPath: { not: null } },           // Tiene disco
      ],
    },
    select: { id: true, type: true, groupId: true, mimeType: true, driveFileId: true, localPath: true, name: true },
  });

  log(`Documentos pendientes: ${docs.length}`);

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(batch.map(async (doc) => {
      const key = docKey(doc.groupId, doc.id, doc.type);

      log(`[Doc] ${doc.name} (${doc.id.slice(0, 8)}) → ${key}`);

      if (DRY_RUN) {
        stats.docs.skipped++;
        return;
      }

      const buffer = await downloadDocumentBufferSafe({
        driveFileId: doc.driveFileId,
        localPath: doc.localPath,
      });

      if (!buffer) {
        log(`  ✗ No se pudo descargar: ${doc.id}`);
        stats.docs.failed++;
        return;
      }

      try {
        await storage.upload(key, buffer, doc.mimeType ?? 'application/octet-stream');
        await prisma.document.update({
          where: { id: doc.id },
          data: { storageKey: key, syncStatus: 'completed', lastSyncAt: new Date() },
        });
        log(`  ✓ Migrado (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
        stats.docs.ok++;
      } catch (e) {
        log(`  ✗ Error subiendo a R2: ${(e as Error).message}`);
        stats.docs.failed++;
      }
    }));

    log(`  [Doc] Lote ${i / BATCH_SIZE + 1}: ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length} procesados`);
  }
}

// ─── 2. Migrar versiones ──────────────────────────────────────────────────────
async function migrateVersions() {
  log('=== Migrando versiones ===');

  const versions = await (prisma.documentVersion as any).findMany({
    where: {
      storageKey: null,
      OR: [
        { cloudUrl: { not: null } },
        { localPath: { not: null } },
      ],
    },
    select: {
      id: true, documentId: true, version: true,
      cloudUrl: true, localPath: true,
      document: { select: { type: true, groupId: true } },
    },
  });

  log(`Versiones pendientes: ${versions.length}`);

  for (let i = 0; i < versions.length; i += BATCH_SIZE) {
    const batch = versions.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(batch.map(async (ver: any) => {
      const { type, groupId } = ver.document;
      const key = versionKey(groupId, ver.documentId, ver.version, type);

      log(`[Ver] v${ver.version} de ${ver.documentId.slice(0, 8)} → ${key}`);

      if (DRY_RUN) {
        stats.versions.skipped++;
        return;
      }

      const buffer = await downloadDocumentBufferSafe({
        driveFileId: ver.cloudUrl,
        localPath: ver.localPath,
      });

      if (!buffer) {
        log(`  ✗ No se pudo descargar versión ${ver.id}`);
        stats.versions.failed++;
        return;
      }

      try {
        await storage.upload(key, buffer, 'application/octet-stream');
        await (prisma.documentVersion as any).update({
          where: { id: ver.id },
          data: { storageKey: key },
        });
        log(`  ✓ Versión migrada`);
        stats.versions.ok++;
      } catch (e) {
        log(`  ✗ Error: ${(e as Error).message}`);
        stats.versions.failed++;
      }
    }));
  }
}

// ─── 3. Migrar PDFs ───────────────────────────────────────────────────────────
async function migratePdfs() {
  log('=== Migrando PDFs ===');

  const pdfs = await (prisma as any).documentPdf.findMany({
    where: {
      storageKey: null,
      OR: [
        { driveFileId: { not: null } },
        { localPath: { not: null } },
      ],
    },
    select: {
      id: true, documentId: true, name: true,
      driveFileId: true, localPath: true,
      document: { select: { groupId: true } },
    },
  });

  log(`PDFs pendientes: ${pdfs.length}`);

  for (let i = 0; i < pdfs.length; i += BATCH_SIZE) {
    const batch = pdfs.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(batch.map(async (pdf: any) => {
      const key = pdfKey(pdf.document.groupId, pdf.documentId, pdf.id);

      log(`[PDF] ${pdf.name} → ${key}`);

      if (DRY_RUN) {
        stats.pdfs.skipped++;
        return;
      }

      const buffer = await downloadDocumentBufferSafe({
        driveFileId: pdf.driveFileId,
        localPath: pdf.localPath,
      });

      if (!buffer) {
        log(`  ✗ No se pudo descargar PDF ${pdf.id}`);
        stats.pdfs.failed++;
        return;
      }

      try {
        await storage.upload(key, buffer, 'application/pdf');
        await (prisma as any).documentPdf.update({
          where: { id: pdf.id },
          data: { storageKey: key },
        });
        log(`  ✓ PDF migrado`);
        stats.pdfs.ok++;
      } catch (e) {
        log(`  ✗ Error: ${(e as Error).message}`);
        stats.pdfs.failed++;
      }
    }));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log(`Iniciando migración a R2 (dry-run=${DRY_RUN}, batch=${BATCH_SIZE})`);
  log(`Proveedor: ${process.env.STORAGE_PROVIDER ?? 'r2'}`);

  // Inicializar storage aquí (después de loadEnv)
  storage = getStorageProvider();

  // Verificar conectividad con R2
  const healthy = await storage.healthCheck();
  if (!healthy) {
    console.error('✗ El proveedor de almacenamiento no está disponible. Verifica las variables STORAGE_PROVIDER, R2_*.');
    process.exit(1);
  }
  log('✓ Conectividad con R2 verificada');

  await migrateDocuments();
  await migrateVersions();
  await migratePdfs();

  console.log('\n=== Resumen ===');
  console.table({
    Documentos: stats.docs,
    Versiones: stats.versions,
    PDFs: stats.pdfs,
  });

  if (DRY_RUN) {
    log('Modo dry-run: no se realizaron cambios.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error fatal en migración:', e);
  await prisma.$disconnect();
  process.exit(1);
});
