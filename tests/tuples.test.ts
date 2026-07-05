import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-tuples');
const FIXTURE = 'tests/fixtures/tuples.yml';

describe('tuple generation', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates tuple type for prefixItems', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'pair-list.ts'), 'utf8');
    expect(content).toContain('pairs: [string, number];');
  });
});