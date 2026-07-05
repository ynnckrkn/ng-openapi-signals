import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createJiti} from 'jiti';
import type {GeneratorConfig, GroupBy, PartialGeneratorConfig} from './codegen/types';

export const DEFAULT_CONFIG: GeneratorConfig = {
  input: '',
  output: '',
  clean: true,
  groupBy: 'tag',
};

export const DEFAULT_CONFIG_FILE = 'ng-openapi-signals.config.ts';

/**
 * Helper for type inference in user config files.
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   input: './openapi.json',
 *   output: './src/generated/api',
 *   groupBy: 'tag',
 * });
 * ```
 */
export function defineConfig(config: PartialGeneratorConfig): PartialGeneratorConfig {
  return config;
}

/**
 * Loads a config file (`ng-openapi-signals.config.ts`) from the given path
 * or from the current working directory.
 *
 * Returns an empty object if no config file is found.
 */
export async function loadConfig(
  configPath?: string,
): Promise<PartialGeneratorConfig> {
  const filePath = resolve(configPath ?? DEFAULT_CONFIG_FILE);

  if (!existsSync(filePath)) {
    return {};
  }

  const jiti = createJiti(import.meta.url);
  const module = await jiti.import(pathToFileURL(filePath).href);
  return (module as {default?: PartialGeneratorConfig}).default ?? {};
}

/**
 * Merges CLI options (highest priority) over file config over defaults.
 */
export function resolveConfig(
  cliOptions: PartialGeneratorConfig,
  fileConfig: PartialGeneratorConfig,
): GeneratorConfig {
  return {
    input: cliOptions.input ?? fileConfig.input ?? DEFAULT_CONFIG.input,
    output: cliOptions.output ?? fileConfig.output ?? DEFAULT_CONFIG.output,
    clean: cliOptions.clean ?? fileConfig.clean ?? DEFAULT_CONFIG.clean,
    groupBy: cliOptions.groupBy ?? fileConfig.groupBy ?? DEFAULT_CONFIG.groupBy,
  };
}

/**
 * Validates that the resolved config has the required `input` and `output` paths.
 */
export function validateConfig(config: GeneratorConfig): void {
  if (!config.input) {
    throw new Error(
      'No input path provided. Set it via --input, in the config file, or ng-openapi-signals.config.ts.',
    );
  }

  if (!config.output) {
    throw new Error(
      'No output path provided. Set it via --output, in the config file, or ng-openapi-signals.config.ts.',
    );
  }

  if (config.groupBy !== 'tag' && config.groupBy !== 'path') {
    throw new Error(
      `Invalid groupBy value: '${config.groupBy}'. Must be 'tag' or 'path'.`,
    );
  }
}

/**
 * Type guard for the `GroupBy` union.
 */
export function isGroupBy(value: unknown): value is GroupBy {
  return value === 'tag' || value === 'path';
}