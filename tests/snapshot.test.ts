import {describe, it, expect, afterAll} from 'vitest';
import {rm, readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-snapshot');

/** Recursively lists all `.ts` files under `dir` as paths relative to `dir`. */
async function listTsFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const nested = await listTsFiles(fullPath, relPath);
      files.push(...nested);
    } else if (entry.name.endsWith('.ts')) {
      files.push(relPath);
    }
  }

  return files;
}

// Generate the example output once at module load so the file list is
// available for dynamic `it()` registration.
await rm(OUTPUT_DIR, {recursive: true, force: true});

// Use the same config as `npm run generate:example` (see
// examples/ng-openapi-signals.config.ts) so snapshots reflect the
// real generated output.
await generate({
  input: 'examples/openapi.yml',
  output: OUTPUT_DIR,
  clean: true,
  groupBy: 'tag',
  runtime: {
    transport: 'fetch',
    defaultHeaders: {},
    responseTypeHints: true,
    defaultQueryStyle: 'form',
    defaultQueryExplode: true,
    preferContentType: 'application/json',
    signalMutations: true,
    dateTransformer: true,
  },
});

const tsFiles = (await listTsFiles(OUTPUT_DIR)).sort();
const fileMap = new Map<string, string>();

for (const relPath of tsFiles) {
  const content = await readFile(join(OUTPUT_DIR, relPath), 'utf8');
  fileMap.set(relPath, content);
}

describe('generated example output snapshots', () => {
  afterAll(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates at least one file', () => {
    expect(fileMap.size).toBeGreaterThan(0);
  });

  // Snapshot every generated file individually so that a change in one
  // file produces a focused, reviewable diff rather than a single giant
  // snapshot.
  for (const relPath of tsFiles) {
    it(`matches snapshot for ${relPath}`, () => {
      const content = fileMap.get(relPath)!;
      expect(content).toMatchSnapshot(relPath);
    });
  }
});
