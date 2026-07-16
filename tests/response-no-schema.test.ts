import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/response-no-schema.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-response-no-schema');

describe('response without schema', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  async function readApiFile(): Promise<string> {
    return readFile(join(OUTPUT_DIR, 'resources', 'echo.api.ts'), 'utf8');
  }

  it('uses unknown return type for 200 without schema', async () => {
    const content = await readApiFile();
    expect(content).toContain('echoBody(');
    expect(content).toContain('Promise<unknown>');
    expect(content).toContain('request<unknown>');
  });

  it('uses void return type for 204 no content', async () => {
    const content = await readApiFile();
    expect(content).toContain('deleteNoSchema(');
    expect(content).toContain('Promise<void>');
    expect(content).toContain('request<void>');
  });
});