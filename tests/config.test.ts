import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {rm, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {
  loadConfig,
  resolveConfig,
  validateConfig,
  defineConfig,
  isGroupBy,
  DEFAULT_CONFIG,
} from '../src/config.js';

const TMP_DIR = join(process.cwd(), 'tests', '.tmp-config');

describe('config', () => {
  beforeEach(async () => {
    await rm(TMP_DIR, {recursive: true, force: true});
    await mkdir(TMP_DIR, {recursive: true});
  });

  afterEach(async () => {
    await rm(TMP_DIR, {recursive: true, force: true});
  });

  describe('loadConfig', () => {
    it('returns empty object when no config file exists', async () => {
      const originalCwd = process.cwd();
      process.chdir(TMP_DIR);
      try {
        const config = await loadConfig();
        expect(config).toEqual({});
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('loads a config file with default export', async () => {
      const configPath = join(TMP_DIR, 'ng-openapi-signals.config.ts');
      await writeFile(
        configPath,
        `export default {\n  input: './openapi.json',\n  output: './src/generated/api',\n  apiBaseUrlToken: 'CUSTOM_API_URL',\n};\n`,
        'utf8',
      );

      const config = await loadConfig(configPath);
      expect(config.input).toBe('./openapi.json');
      expect(config.output).toBe('./src/generated/api');
      expect(config.apiBaseUrlToken).toBe('CUSTOM_API_URL');
    });
  });

  describe('resolveConfig', () => {
    it('uses defaults when no overrides provided', () => {
      const config = resolveConfig({}, {});
      expect(config.clean).toBe(DEFAULT_CONFIG.clean);
      expect(config.apiBaseUrlToken).toBe(DEFAULT_CONFIG.apiBaseUrlToken);
      expect(config.groupBy).toBe(DEFAULT_CONFIG.groupBy);
    });

    it('file config overrides defaults', () => {
      const config = resolveConfig(
        {},
        {input: './openapi.json', output: './out', apiBaseUrlToken: 'FILE_TOKEN'},
      );
      expect(config.input).toBe('./openapi.json');
      expect(config.output).toBe('./out');
      expect(config.apiBaseUrlToken).toBe('FILE_TOKEN');
    });

    it('CLI options override file config', () => {
      const config = resolveConfig(
        {apiBaseUrlToken: 'CLI_TOKEN'},
        {apiBaseUrlToken: 'FILE_TOKEN'},
      );
      expect(config.apiBaseUrlToken).toBe('CLI_TOKEN');
    });

    it('CLI clean=false overrides file clean=true', () => {
      const config = resolveConfig({clean: false}, {clean: true});
      expect(config.clean).toBe(false);
    });

    it('CLI groupBy overrides file groupBy', () => {
      const config = resolveConfig({groupBy: 'path'}, {groupBy: 'tag'});
      expect(config.groupBy).toBe('path');
    });
  });

  describe('validateConfig', () => {
    it('throws when input is missing', () => {
      expect(() => validateConfig({...DEFAULT_CONFIG, input: ''})).toThrow(
        'No input path provided',
      );
    });

    it('throws when output is missing', () => {
      expect(() =>
        validateConfig({...DEFAULT_CONFIG, input: './openapi.json', output: ''}),
      ).toThrow('No output path provided');
    });

    it('does not throw when input and output are set', () => {
      expect(() =>
        validateConfig({...DEFAULT_CONFIG, input: './openapi.json', output: './out'}),
      ).not.toThrow();
    });
  });

  describe('defineConfig', () => {
    it('returns the config object as-is', () => {
      const config = defineConfig({input: './openapi.json', output: './out'});
      expect(config.input).toBe('./openapi.json');
      expect(config.output).toBe('./out');
    });
  });

  describe('isGroupBy', () => {
    it('returns true for tag and path', () => {
      expect(isGroupBy('tag')).toBe(true);
      expect(isGroupBy('path')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isGroupBy('invalid')).toBe(false);
      expect(isGroupBy(undefined)).toBe(false);
    });
  });
});