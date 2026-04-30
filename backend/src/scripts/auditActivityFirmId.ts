import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_ROOT = join(process.cwd(), 'src');
const LOOKAHEAD_CHARS = 420;
const CREATE_REGEX = /activityLog\.create(?:Many)?\(\{\s*data:\s*\{/g;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRelativePath(filePath: string): string {
  return filePath.replace(`${process.cwd()}/`, '');
}

function collectMissingFirmId(filePath: string): Array<{ file: string; line: number }> {
  const content = readFileSync(filePath, 'utf8');
  const missing: Array<{ file: string; line: number }> = [];

  for (const match of content.matchAll(CREATE_REGEX)) {
    const start = match.index ?? 0;
    const snippet = content.slice(start, start + LOOKAHEAD_CHARS);
    if (snippet.includes('firmId')) continue;

    const line = content.slice(0, start).split('\n').length;
    missing.push({ file: toRelativePath(filePath), line });
  }

  return missing;
}

function main() {
  const rootArg = process.argv[2];
  const root = rootArg ? join(process.cwd(), rootArg) : DEFAULT_ROOT;

  const files = walk(root);
  const missing = files.flatMap(collectMissingFirmId);

  if (missing.length === 0) {
    console.log('OK: todos los activityLog.create/createMany incluyen firmId.');
    process.exit(0);
  }

  console.error(`Faltan firmId en ${missing.length} logs de actividad:`);
  for (const item of missing) {
    console.error(`- ${item.file}:${item.line}`);
  }
  process.exit(1);
}

main();
