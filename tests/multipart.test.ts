import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const FIXTURE = 'tests/fixtures/multipart-upload.yml';
const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-multipart');

describe('multipart form data generation', () => {
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
    return readFile(join(OUTPUT_DIR, 'resources', 'upload.api.ts'), 'utf8');
  }

  it('generates formData instead of body for multipart', async () => {
    const content = await readApiFile();
    expect(content).toContain('formData: body');
    expect(content).toContain("contentType: 'multipart/form-data'");
  });

  it('does not pass body for multipart requests', async () => {
    const content = await readApiFile();
    // The uploadAvatar method should not have a plain 'body,' line
    const methodMatch = content.match(/uploadAvatar[\s\S]*?\n {2}}/);
    expect(methodMatch).not.toBeNull();
    expect(methodMatch![0]).not.toMatch(/^\s*body,$/m);
  });

  it('uses Blob type for binary file part', async () => {
    // The Blob type is in the generated model, not the API file.
    const modelContent = await readFile(
      join(OUTPUT_DIR, 'models', 'upload-avatar-request.ts'),
      'utf8',
    );
    expect(modelContent).toContain('Blob');
  });

  it('generates formData for application/x-www-form-urlencoded', async () => {
    const content = await readApiFile();
    // createBulkUsers uses x-www-form-urlencoded
    const methodMatch = content.match(/createBulkUsers[\s\S]*?\n {2}}/);
    expect(methodMatch).not.toBeNull();
    expect(methodMatch![0]).toContain('formData: body');
    expect(methodMatch![0]).toContain(
      "contentType: 'application/x-www-form-urlencoded'",
    );
  });
});