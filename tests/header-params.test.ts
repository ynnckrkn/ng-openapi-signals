import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/header-params.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-header-params');

describe('header parameter generation', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({
      input: FIXTURE,
      output: OUTPUT_DIR,
      clean: true,
      groupBy: 'tag',
    });
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  async function readApiFile(): Promise<string> {
    return readFile(join(OUTPUT_DIR, 'resources', 'header.api.ts'), 'utf8');
  }

  it('includes header params in the params type with quoted names', async () => {
    const content = await readApiFile();
    expect(content).toContain("'X-Request-Id'");
    expect(content).toContain("'X-Client-Version'");
  });

  it('generates headers object in the request', async () => {
    const content = await readApiFile();
    expect(content).toContain("headers: {");
    expect(content).toContain("'X-Request-Id': params['X-Request-Id']");
  });

  it('uses bracket notation for header param access', async () => {
    const content = await readApiFile();
    expect(content).toContain("params['X-Request-Id']");
    expect(content).toContain("params['X-Client-Version']");
  });

  it('includes header params in resource params factory', async () => {
    const content = await readApiFile();
    // The GET method should have header params in the params factory
    expect(content).toContain("readSignalOrValue(params['X-Request-Id'])");
  });

  it('includes header params in mutation method signatures', async () => {
    const content = await readApiFile();
    // deleteUserWithHeader should have params argument
    expect(content).toContain('deleteUserWithHeader(');
    expect(content).toMatch(/deleteUserWithHeader\([\s\S]*params:/);
  });
});