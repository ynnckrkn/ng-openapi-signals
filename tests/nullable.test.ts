import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-nullable');
const FIXTURE = 'tests/fixtures/nullable.yml';

describe('nullable handling', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('adds | null for nullable: true on string property', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'item.ts'), 'utf8');
    expect(content).toContain('label?: string | null;');
  });

  it('adds | null for nullable: true on array property', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'item.ts'), 'utf8');
    expect(content).toContain('tags?: string[] | null;');
  });

  it('adds | null for nullable: true on $ref property', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'item.ts'), 'utf8');
    expect(content).toContain('ref?: Item | null;');
  });

  it('handles OpenAPI 3.1 type: [string, null]', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'item.ts'), 'utf8');
    expect(content).toContain('typedNull?: string | null;');
  });
});