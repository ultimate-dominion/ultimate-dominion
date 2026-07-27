import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(process.cwd(), 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const FORBIDDEN = [
  /\/images\//,
  /\/models\//,
  /\.glb\b/i,
  /<img\b/i,
  /<Image\b/,
  /<Avatar\b/,
  /role=["']img["']/,
  /new Image\s*\(/,
  /(?:item|monster|class|fragment)Images/,
];

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) return [];
    if (entry.name.includes('.test.') || entry.name.includes('.spec.'))
      return [];
    return [path];
  });
}

describe('text-first client invariant', () => {
  it('does not reintroduce gameplay image or model dependencies', () => {
    const violations = productionSources(SOURCE_ROOT).flatMap(path => {
      const source = readFileSync(path, 'utf8');
      return FORBIDDEN.filter(pattern => pattern.test(source)).map(
        pattern => `${path.replace(`${SOURCE_ROOT}/`, '')}: ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });
});
