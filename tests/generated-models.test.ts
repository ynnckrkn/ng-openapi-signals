import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-models');

describe('generated models', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({
      input: 'examples/openapi.json',
      output: OUTPUT_DIR,
      clean: true,
      groupBy: 'tag',
    });
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates User interface with correct properties', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'user.ts'), 'utf8');
    expect(content).toContain('export interface User {');
    expect(content).toContain('id: string;');
    expect(content).toContain('name: string;');
    expect(content).toContain('email?: string;');
  });

  it('generates CreateUserRequest interface with correct properties', async () => {
    const content = await readFile(
      join(OUTPUT_DIR, 'models', 'create-user-request.ts'),
      'utf8',
    );
    expect(content).toContain('export interface CreateUserRequest {');
    expect(content).toContain('name: string;');
    expect(content).toContain('email?: string;');
  });

  it('generates models/index.ts re-exporting all models', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'index.ts'), 'utf8');
    expect(content).toContain("export * from './user';");
    expect(content).toContain("export * from './create-user-request';");
  });
});