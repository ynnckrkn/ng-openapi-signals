import {describe, it, expect} from 'vitest';
import {generateRuntimeFiles} from '../src/codegen/generate-runtime.js';
import {generateDateUtils} from '../src/codegen/runtime/date-utils.js';
import type {GeneratorConfig} from '../src/codegen/types.js';

const BASE_CONFIG: GeneratorConfig = {
  input: 'examples/openapi.yml',
  output: 'examples/generated',
  clean: true,
  groupBy: 'tag',
};

/* ------------------------------------------------------------------ *
 * transformDates — mirrors the generated runtime logic so we can
 * unit-test the behaviour without loading Angular.
 * ------------------------------------------------------------------ */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function transformDates(body: unknown): unknown {
  if (body === null || body === undefined) {
    return body;
  }

  if (body instanceof Date) {
    return body;
  }

  if (typeof body === 'string') {
    if (ISO_DATE_TIME.test(body)) {
      const date = new Date(body);
      return Number.isNaN(date.getTime()) ? body : date;
    }
    return body;
  }

  if (Array.isArray(body)) {
    return body.map(transformDates);
  }

  if (typeof body === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      result[key] = transformDates(value);
    }
    return result;
  }

  return body;
}

describe('transformDates', () => {
  it('converts a full ISO-8601 timestamp with Z', () => {
    const result = transformDates('2026-07-15T12:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });

  it('converts an ISO-8601 timestamp with offset', () => {
    const result = transformDates('2026-07-15T12:00:00+02:00');
    expect(result).toBeInstanceOf(Date);
  });

  it('converts an ISO-8601 timestamp with fractional seconds', () => {
    const result = transformDates('2026-07-15T12:00:00.123Z');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getMilliseconds()).toBe(123);
  });

  it('converts a timestamp without timezone', () => {
    const result = transformDates('2026-07-15T12:00:00');
    expect(result).toBeInstanceOf(Date);
  });

  it('does NOT convert a date-only string', () => {
    const result = transformDates('2026-07-15');
    expect(result).toBe('2026-07-15');
  });

  it('does not convert arbitrary strings', () => {
    expect(transformDates('hello')).toBe('hello');
    expect(transformDates('12345')).toBe('12345');
    expect(transformDates('2026/07/15 12:00')).toBe('2026/07/15 12:00');
  });

  it('passes through numbers and booleans', () => {
    expect(transformDates(42)).toBe(42);
    expect(transformDates(true)).toBe(true);
  });

  it('passes through null and undefined', () => {
    expect(transformDates(null)).toBe(null);
    expect(transformDates(undefined)).toBe(undefined);
  });

  it('passes through existing Date instances', () => {
    const date = new Date('2026-07-15T12:00:00Z');
    expect(transformDates(date)).toBe(date);
  });

  it('recurses into arrays', () => {
    const result = transformDates(['2026-07-15T12:00:00Z', 'plain', 42]) as unknown[];
    expect(result[0]).toBeInstanceOf(Date);
    expect(result[1]).toBe('plain');
    expect(result[2]).toBe(42);
  });

  it('recurses into nested objects', () => {
    const result = transformDates({
      id: 1,
      createdAt: '2026-07-15T12:00:00Z',
      name: 'Alice',
      nested: {updatedAt: '2026-07-16T08:30:00Z'},
    }) as Record<string, unknown>;

    expect(result['id']).toBe(1);
    expect(result['createdAt']).toBeInstanceOf(Date);
    expect(result['name']).toBe('Alice');
    const nested = result['nested'] as Record<string, unknown>;
    expect(nested['updatedAt']).toBeInstanceOf(Date);
  });

  it('recurses into arrays of objects', () => {
    const result = transformDates([
      {ts: '2026-07-15T12:00:00Z'},
      {ts: '2026-07-16T08:30:00Z'},
    ]) as Array<Record<string, unknown>>;
    expect(result[0]?.['ts']).toBeInstanceOf(Date);
    expect(result[1]?.['ts']).toBeInstanceOf(Date);
  });

  it('falls back to the original string for an un-parseable match', () => {
    // The regex matches, but Date produces Invalid Date for out-of-range
    // values like month 13.
    const result = transformDates('2026-13-45T12:00:00Z');
    expect(result).toBe('2026-13-45T12:00:00Z');
  });
});

/* ------------------------------------------------------------------ *
 * Codegen wiring — verify the generator emits date-utils and hooks
 * it into both transport clients.
 * ------------------------------------------------------------------ */
describe('generateRuntimeFiles — dateTransformer', () => {
  it('does not emit date-utils.ts when dateTransformer is false (default)', () => {
    const files = generateRuntimeFiles(BASE_CONFIG);
    expect(files).not.toHaveProperty('date-utils.ts');
  });

  it('emits date-utils.ts when dateTransformer is true (fetch)', () => {
    const files = generateRuntimeFiles({
      ...BASE_CONFIG,
      runtime: {dateTransformer: true},
    });
    expect(files).toHaveProperty('date-utils.ts');
    expect(files['date-utils.ts']).toContain('export function transformDates');
    expect(files['date-utils.ts']).toContain('ISO_DATE_TIME');
  });

  it('wires transformDates into api-fetch-client.ts parseJson', () => {
    const files = generateRuntimeFiles({
      ...BASE_CONFIG,
      runtime: {dateTransformer: true},
    });
    const client = files['api-fetch-client.ts'];
    expect(client).toContain("import { transformDates } from './date-utils'");
    expect(client).toContain('return transformDates(JSON.parse(text))');
  });

  it('does not wire transformDates when dateTransformer is false', () => {
    const files = generateRuntimeFiles(BASE_CONFIG);
    const client = files['api-fetch-client.ts'];
    expect(client).not.toContain('transformDates');
    expect(client).not.toContain('date-utils');
  });

  it('emits date-utils.ts when dateTransformer is true (httpClient)', () => {
    const files = generateRuntimeFiles({
      ...BASE_CONFIG,
      runtime: {transport: 'httpClient', dateTransformer: true},
    });
    expect(files).toHaveProperty('date-utils.ts');
    const client = files['api-http-client.ts'];
    expect(client).toContain("import { transformDates } from './date-utils'");
    expect(client).toContain(
      "options.responseType === 'json' ? transformDates(response.body) : response.body",
    );
  });

  it('does not wire transformDates in httpClient when dateTransformer is false', () => {
    const files = generateRuntimeFiles({
      ...BASE_CONFIG,
      runtime: {transport: 'httpClient'},
    });
    const client = files['api-http-client.ts'];
    expect(client).not.toContain('transformDates');
    expect(client).not.toContain('date-utils');
  });
});

describe('generateDateUtils', () => {
  it('exports transformDates and the ISO_DATE_TIME constant', () => {
    const code = generateDateUtils();
    expect(code).toContain('export function transformDates');
    expect(code).toContain('ISO_DATE_TIME');
    // Regex should match ISO-8601 date-time, not date-only.
    expect(code).toContain('\\d{4}-\\d{2}-\\d{2}T');
  });
});