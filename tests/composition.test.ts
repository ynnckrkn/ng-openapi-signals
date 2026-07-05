import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-composition');
const FIXTURE = 'tests/fixtures/composition.yml';

describe('composition (allOf/oneOf/anyOf)', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates allOf as intersection type alias', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'pet.ts'), 'utf8');
    expect(content).toContain('export type Pet =');
    expect(content).toContain('Named & Aged');
  });

  it('generates oneOf as union type alias', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'animal.ts'), 'utf8');
    expect(content).toContain('export type Animal =');
    expect(content).toContain('Pet |');
  });

  it('generates anyOf as union type alias', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'mixed.ts'), 'utf8');
    expect(content).toContain('export type Mixed =');
    expect(content).toContain('Named | Aged');
  });
});