import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generate} from '../src/generate.js';

const OUTPUT_DIR = join(process.cwd(), 'tests', '.tmp-inline');
const FIXTURE = 'tests/fixtures/inline-schemas.yml';

describe('inline schema hoisting', () => {
  beforeEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
    await generate({input: FIXTURE, output: OUTPUT_DIR, clean: true, groupBy: 'tag'});
  });

  afterEach(async () => {
    await rm(OUTPUT_DIR, {recursive: true, force: true});
  });

  it('hoists inline request body object to a named model', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'index.ts'), 'utf8');
    expect(content).toContain('create-order-request');
  });

  it('hoists inline response object to a named model', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'models', 'index.ts'), 'utf8');
    expect(content).toContain('create-order-response');
  });

  it('hoists nested inline object (customer.address) to a named model', async () => {
    const dir = await readFile(join(OUTPUT_DIR, 'models', 'index.ts'), 'utf8');
    // The nested address object should be hoisted to a named type.
    expect(dir).toContain('create-order-request-customer-address');
  });

  it('uses $ref in the API file instead of inline object', async () => {
    const content = await readFile(join(OUTPUT_DIR, 'resources', 'orders.api.ts'), 'utf8');
    expect(content).toContain('CreateOrderRequest');
    expect(content).toContain('CreateOrderResponse');
  });
});