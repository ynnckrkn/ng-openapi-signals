import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/response-types.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-response-types');

describe('response type hints', () => {
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
    return readFile(join(OUTPUT_DIR, 'resources', 'content.api.ts'), 'utf8');
  }

  it('emits responseType: text for text/plain responses', async () => {
    const content = await readApiFile();
    expect(content).toContain(`responseType: 'text'`);
  });

  it('emits responseType: blob for image/png responses', async () => {
    const content = await readApiFile();
    expect(content).toContain(`responseType: 'blob'`);
  });

  it('emits responseType: json for application/json responses', async () => {
    const content = await readApiFile();
    expect(content).toContain(`responseType: 'json'`);
  });

  it('does not emit responseType for 204 no-content responses', async () => {
    const content = await readApiFile();
    // deleteNoContent returns void and should not carry a responseType hint.
    // Isolate the method body by matching from its signature to the closing brace.
    const match = content.match(/deleteNoContent[\s\S]*?\n {2}}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toContain('responseType');
  });

  it('uses string return type for text responses', async () => {
    const content = await readApiFile();
    expect(content).toContain('request<string>');
  });

  it('uses Blob return type for binary responses', async () => {
    const content = await readApiFile();
    expect(content).toContain('request<Blob>');
  });

  it('does not import Blob from models', async () => {
    const content = await readApiFile();
    expect(content).not.toContain('{ Blob');
    expect(content).not.toMatch(/import.*\bBlob\b.*from '\.\.\/models'/);
  });
});

describe('response type hints disabled', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({
      input: FIXTURE,
      output: OUTPUT_DIR,
      clean: true,
      groupBy: 'tag',
      runtime: {responseTypeHints: false},
    });
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('does not emit responseType when responseTypeHints is false', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'content.api.ts'), 'utf8');
    expect(content).not.toContain('responseType');
  });

  it('still uses Blob return type for binary responses', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'content.api.ts'), 'utf8');
    expect(content).toContain('request<Blob>');
  });
});