import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/query-styles.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-query-styles');

describe('query parameter styles', () => {
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
    return readFile(join(OUTPUT_DIR, 'resources', 'query.api.ts'), 'utf8');
  }

  it('wraps spaceDelimited query param with style metadata', async () => {
    const content = await readApiFile();
    expect(content).toContain("style: 'spaceDelimited'");
    expect(content).toContain('explode: false');
  });

  it('wraps pipeDelimited query param with style metadata', async () => {
    const content = await readApiFile();
    expect(content).toContain("style: 'pipeDelimited'");
  });

  it('wraps deepObject query param with style metadata', async () => {
    const content = await readApiFile();
    expect(content).toContain("style: 'deepObject'");
  });

  it('wraps form+explode:false query param with style metadata', async () => {
    const content = await readApiFile();
    expect(content).toContain("style: 'form'");
    // The 'ids' param uses form + explode:false
    expect(content).toMatch(/ids.*style: 'form'.*explode: false/s);
  });

  it('passes default query params (form+explode:true) as plain values', async () => {
    const content = await readApiFile();
    // 'q' has no style/explode specified, so it should be a plain value.
    // Match the q line in the query object (indented), not across the whole file.
    expect(content).toContain('q: params.q');
    // The q line should not contain 'style:' on the same line.
    const qLine = content.split('\n').find((line) => line.includes('q: params.q'));
    expect(qLine).toBeDefined();
    expect(qLine).not.toContain('style:');
  });
});