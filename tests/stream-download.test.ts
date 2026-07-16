import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/stream-download.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-stream-download');

describe('stream download response type', () => {
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
    return readFile(join(OUTPUT_DIR, 'resources', 'stream.api.ts'), 'utf8');
  }

  it('emits responseType: stream for text/event-stream', async () => {
    const content = await readApiFile();
    expect(content).toContain("responseType: 'stream'");
  });

  it('emits responseType: blob for application/octet-stream', async () => {
    const content = await readApiFile();
    expect(content).toContain("responseType: 'blob'");
  });

  it('uses ReadableStream return type for event-stream', async () => {
    const content = await readApiFile();
    expect(content).toContain('request<ReadableStream>');
  });

  it('uses Blob return type for octet-stream binary', async () => {
    const content = await readApiFile();
    expect(content).toContain('request<Blob>');
  });
});