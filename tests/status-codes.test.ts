import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-status');
const FIXTURE = 'tests/fixtures/status-codes.yml';

describe('success response status codes', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('unions multiple 2xx response types', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'multi.api.ts'), 'utf8');
    expect(content).toContain('Foo | Bar');
  });

  it('uses single 2xx type when only one success response', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'multi.api.ts'), 'utf8');
    expect(content).toContain('request<Bar>');
  });

  it('returns void for 204 no content', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'multi.api.ts'), 'utf8');
    expect(content).toContain('getNoContentResource');
    expect(content).toContain('request<void>');
  });

  it('handles 2XX range status codes (OpenAPI 3.1)', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'multi.api.ts'), 'utf8');
    expect(content).toContain('getRangeResource');
    expect(content).toContain('request<Foo>');
  });

  it('does not use error response types (4xx)', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'multi.api.ts'), 'utf8');
    // Error schema should not appear in the response type union.
    expect(content).not.toContain('Foo | Bar | Error');
    expect(content).not.toContain('request<Error>');
  });
});