import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadOpenApi} from '../src/openapi.js';
import {validateConfig, DEFAULT_CONFIG} from '../src/config.js';
import {generateFiles} from '../src/generate.js';

const TMP_DIR = join(process.cwd(), 'tests', '.tmp-error-messages');
const MISSING_INPUT = join(TMP_DIR, 'does-not-exist.json');
const INVALID_OPENAPI = join(TMP_DIR, 'invalid.json');

describe('error messages', () => {
  beforeEach(async () => {
    await rm(TMP_DIR, {recursive: true, force: true});
    await mkdir(TMP_DIR, {recursive: true});
  });

  afterEach(async () => {
    await rm(TMP_DIR, {recursive: true, force: true});
  });

  describe('loadOpenApi', () => {
    it('reports a clear message when the input file is missing', async () => {
      await expect(loadOpenApi(MISSING_INPUT)).rejects.toThrow(
        /OpenAPI input file not found/,
      );
      await expect(loadOpenApi(MISSING_INPUT)).rejects.toThrow(MISSING_INPUT);
    });

    it('reports a parse error with the file path on invalid OpenAPI', async () => {
      await writeFile(INVALID_OPENAPI, '{ not valid openapi', 'utf8');

      await expect(loadOpenApi(INVALID_OPENAPI)).rejects.toThrow(
        /Failed to parse OpenAPI document/,
      );
      await expect(loadOpenApi(INVALID_OPENAPI)).rejects.toThrow(INVALID_OPENAPI);
    });

    it('reports a clear message when the document has no paths', async () => {
      const noPaths = join(TMP_DIR, 'no-paths.json');

      // Missing `paths` entirely — rejected by swagger-parser validation.
      await writeFile(
        noPaths,
        JSON.stringify({openapi: '3.0.0', info: {title: 'x', version: '1'}}),
        'utf8',
      );

      await expect(loadOpenApi(noPaths)).rejects.toThrow(noPaths);
    });
  });

  describe('validateConfig', () => {
    it('uses a Configuration error prefix for missing input', () => {
      expect(() => validateConfig({...DEFAULT_CONFIG, input: ''})).toThrow(
        /Configuration error: no input path provided/,
      );
    });

    it('uses a Configuration error prefix for missing output', () => {
      expect(() =>
        validateConfig({...DEFAULT_CONFIG, input: './openapi.json', output: ''}),
      ).toThrow(/Configuration error: no output path provided/);
    });

    it('uses a Configuration error prefix for invalid groupBy', () => {
      expect(() =>
        validateConfig({
          ...DEFAULT_CONFIG,
          input: './openapi.json',
          output: './out',
          groupBy: 'invalid' as unknown as 'tag',
        }),
      ).toThrow(/Configuration error: invalid groupBy value/);
    });
  });

  describe('generateFiles', () => {
    it('surfaces a clear error for a missing input file', async () => {
      await expect(
        generateFiles({
          input: MISSING_INPUT,
          output: TMP_DIR,
          clean: true,
          groupBy: 'tag',
        }),
      ).rejects.toThrow(/OpenAPI input file not found/);
    });
  });
});