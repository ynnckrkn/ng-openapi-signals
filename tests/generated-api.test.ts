import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-api');

describe('generated API', () => {
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

  async function readApiFile(): Promise<string> {
    return readFile(join(OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
  }

  it('imports model types (User, CreateUserRequest)', async () => {
    const content = await readApiFile();
    expect(content).toContain("import { CreateUserRequest, User } from '../models';");
  });

  it('uses User as the response type for getUserById', async () => {
    const content = await readApiFile();
    expect(content).toContain('this.client.request<User>');
  });

  it('uses User[] as the response type for searchUsers', async () => {
    const content = await readApiFile();
    expect(content).toContain('this.client.request<User[]>');
  });

  it('uses CreateUserRequest as the body type for createUser', async () => {
    const content = await readApiFile();
    expect(content).toContain('body: CreateUserRequest');
  });

  it('does not emit params: void in createUser', async () => {
    const content = await readApiFile();
    expect(content).not.toContain('params: void');
  });

  it('does not use as any casts', async () => {
    const content = await readApiFile();
    expect(content).not.toContain('as any');
  });

  it('createUser signature has body and signal only', async () => {
    const content = await readApiFile();
    expect(content).toContain(
      'createUser(body: CreateUserRequest, signal?: AbortSignal): Promise<User>',
    );
  });

  it('imports resource from @angular/core', async () => {
    const content = await readApiFile();
    expect(content).toContain('resource');
    expect(content).toContain("from '@angular/core'");
  });

  it('imports MaybeSignal and readSignalOrValue from signal-utils', async () => {
    const content = await readApiFile();
    expect(content).toContain('MaybeSignal');
    expect(content).toContain('readSignalOrValue');
    expect(content).toContain("from '../signal-utils'");
  });
});

describe('generated API with httpClient transport', () => {
  const HTTP_OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-api-http');

  beforeEach(async () => {
    await rm(HTTP_OUTPUT_DIR, {recursive: true, force: true});
    await generate({
      input: 'examples/openapi.json',
      output: HTTP_OUTPUT_DIR,
      clean: true,
      groupBy: 'tag',
      runtime: {transport: 'httpClient'},
    });
  });

  afterEach(async () => {
    await rm(HTTP_OUTPUT_DIR, {recursive: true, force: true});
  });

  it('imports ApiHttpClient from api-http-client', async () => {
    const content = await readFile(join(HTTP_OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain("import { ApiHttpClient } from '../api-http-client';");
    expect(content).toContain('inject(ApiHttpClient)');
    expect(content).not.toContain('ApiFetchClient');
  });

  it('uses the same request method shape as fetch transport', async () => {
    const content = await readFile(join(HTTP_OUTPUT_DIR, 'resources', 'users.api.ts'), 'utf8');
    expect(content).toContain('this.client.request<User>');
    expect(content).toContain('this.client.request<User[]>');
    expect(content).toContain('body: CreateUserRequest');
  });
});