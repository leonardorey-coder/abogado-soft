import { describe, expect, test } from 'bun:test';
import path from 'path';
import { resolveSafeLocalPath } from './downloadHelper.js';

describe('resolveSafeLocalPath', () => {
  test('permite rutas legacy dentro de uploads', () => {
    const allowed = path.resolve(process.cwd(), 'uploads', 'documento.txt');

    expect(resolveSafeLocalPath(allowed)).toBe(allowed);
    expect(resolveSafeLocalPath(path.join('uploads', 'documento.txt'))).toBe(allowed);
  });

  test('rechaza rutas fuera de los directorios legacy', () => {
    expect(resolveSafeLocalPath('/etc/passwd')).toBeNull();
    expect(resolveSafeLocalPath(path.join('uploads', '..', 'package.json'))).toBeNull();
  });
});
