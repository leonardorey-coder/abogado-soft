// =============================================================================
// reindex.ts — Script de re-indexación completa de la base de datos
//
// Uso:  cd backend && bun src/scripts/reindex.ts
//
// - Lee todos los documentos, convenios y expedientes históricos de Prisma
// - Extrae texto de archivos (.docx, .pdf, .txt)
// - Los indexa en Meilisearch en batches de 100
// - Los errores por archivo individual (PDF corrupto, etc.) se loguean y continúan
// =============================================================================

// Cargar .env de raíz si existe
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
      let val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env) || process.env[key] === '') process.env[key] = val;
    }
    break;
  }
}
loadEnv();

// Forzar Meilisearch para el script (puede sobreescribirse con env var)
if (!process.env.SEARCH_ENGINE) process.env.SEARCH_ENGINE = 'meilisearch';

import prisma from '../lib/prisma.js';
import { getSearchService } from '../services/search/SearchServiceFactory.js';
import { extractTextFromFile } from '../services/search/textExtractor.js';
import type { SearchableDocument } from '../services/search/ISearchProvider.js';

const BATCH_SIZE = 100;

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function reindex() {
  const globalStart = Date.now();
  console.log('\n🔍  AbogadoSoft — Re-indexación global');
  console.log(`    Motor: ${process.env.SEARCH_ENGINE}`);
  console.log(`    Host:  ${process.env.MEILISEARCH_HOST ?? 'http://localhost:7700'}`);
  console.log('═'.repeat(52));

  const svc = await getSearchService();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Documentos
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📄  Indexando documentos…');
  const t0 = Date.now();
  const documents = await prisma.document.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, type: true, description: true, tags: true, fileStatus: true, localPath: true, createdAt: true, updatedAt: true },
  });

  let docErrors = 0;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const indexed: SearchableDocument[] = [];
    for (const doc of batch) {
      try {
        const textContent = await extractTextFromFile(doc.localPath);
        indexed.push({
          id: doc.id, entityType: 'document',
          title: doc.name, subtitle: doc.description ?? undefined,
          tags: doc.tags, textContent,
          url: `/documento/${doc.id}`,
          meta: { type: doc.type, fileStatus: doc.fileStatus },
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        });
      } catch {
        docErrors++;
        console.warn(`    ⚠️  Error en: ${doc.name}`);
      }
    }
    await svc.indexBulk(indexed);
    process.stdout.write(`    → ${Math.min(i + BATCH_SIZE, documents.length)}/${documents.length}\r`);
  }
  console.log(`    ✅  ${documents.length} docs (${docErrors} errores) — ${formatMs(Date.now() - t0)}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Convenios
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📋  Indexando convenios…');
  const t1 = Date.now();
  const convenios = await prisma.convenio.findMany({
    select: { id: true, numero: true, institucion: true, descripcion: true, notas: true, estado: true, createdAt: true, updatedAt: true },
  });
  const convDocs: SearchableDocument[] = convenios.map(c => ({
    id: c.id, entityType: 'convenio',
    title: `${c.numero} — ${c.institucion}`,
    subtitle: c.descripcion ?? undefined,
    textContent: [c.descripcion, c.notas].filter(Boolean).join(' '),
    url: `/convenios/${c.id}`,
    meta: { estado: c.estado },
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
  for (let i = 0; i < convDocs.length; i += BATCH_SIZE) await svc.indexBulk(convDocs.slice(i, i + BATCH_SIZE));
  console.log(`    ✅  ${convenios.length} convenios — ${formatMs(Date.now() - t1)}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Expedientes
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n⚖️   Indexando expedientes…');
  const t2 = Date.now();
  const cases = await prisma.case.findMany({
    select: { id: true, caseNumber: true, title: true, client: true, description: true, status: true, caseType: true, createdAt: true, updatedAt: true },
  });
  const caseDocs: SearchableDocument[] = cases.map(c => ({
    id: c.id, entityType: 'case',
    title: `${c.caseNumber} — ${c.title}`,
    subtitle: c.client ?? c.description ?? undefined,
    textContent: c.description ?? '',
    url: `/expedientes/${c.id}`,
    meta: { status: c.status, caseType: c.caseType },
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
  for (let i = 0; i < caseDocs.length; i += BATCH_SIZE) await svc.indexBulk(caseDocs.slice(i, i + BATCH_SIZE));
  console.log(`    ✅  ${cases.length} expedientes — ${formatMs(Date.now() - t2)}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Resumen
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(52));
  console.log(`✨  Completado en ${formatMs(Date.now() - globalStart)}`);
  console.log(`    Total: ${documents.length + convenios.length + cases.length} registros indexados\n`);

  await prisma.$disconnect();
  process.exit(0);
}

reindex().catch(err => {
  console.error('\n❌  Error fatal:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
