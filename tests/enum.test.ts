import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-enum');
const FIXTURE = 'tests/fixtures/enum.yml';

describe('enum generation', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('generates a named union type for string enums', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'user-status.ts'), 'utf8');
    expect(content).toContain('export type UserStatus =');
    expect(content).toContain("'active'");
    expect(content).toContain("'invited'");
    expect(content).toContain("'disabled'");
  });

  it('generates a named union type for integer enums', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'status-code.ts'), 'utf8');
    expect(content).toContain('export type StatusCode =');
    expect(content).toContain('100');
    expect(content).toContain('200');
    expect(content).toContain('300');
  });

  it('re-exports enum types from models/index.ts', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'index.ts'), 'utf8');
    expect(content).toContain("export * from './user-status';");
    expect(content).toContain("export * from './status-code';");
  });

  it('references enum types by name in the interface', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'status-response.ts'), 'utf8');
    expect(content).toContain('status: UserStatus;');
    expect(content).toContain('code: StatusCode;');
    expect(content).toContain('import { StatusCode, UserStatus } from');
  });
});