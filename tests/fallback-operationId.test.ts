import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-fallback');
const FIXTURE = 'tests/fixtures/fallback-operationId.yml';

describe('fallback operationId', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates camelCase fallback for GET /users/{id}', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain('getUsersByIdResource');
  });

  it('generates camelCase fallback for DELETE /users/{id}', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain('deleteUsersById(');
  });

  it('generates camelCase fallback for GET /users', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain('getUsersResource');
  });

  it('generates camelCase fallback for POST /users', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain('createUsers(');
  });
});