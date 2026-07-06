import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createJiti} from 'jiti';
import type {
  GeneratorConfig,
  GroupBy,
  HttpTransport,
  PartialGeneratorConfig,
  RuntimeConfig,
} from './codegen/types';

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  transport: 'fetch',
  defaultHeaders: {},
  responseTypeHints: true,
};

export const DEFAULT_CONFIG: GeneratorConfig = {
  input: '',
  output: '',
  clean: true,
  groupBy: 'tag',
  runtime: {...DEFAULT_RUNTIME_CONFIG},
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
 *
 * The nested `runtime` object is deep-merged field-by-field so that partial
 * overrides (e.g. only `defaultHeaders`) don't wipe out other runtime fields.
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
    runtime: mergeRuntime(
      DEFAULT_CONFIG.runtime,
      fileConfig.runtime,
      cliOptions.runtime,
    ),
  };
}

/**
 * Deep-merges runtime config layers: defaults < file < cli.
 * Object values are merged key-by-key; scalars use `??`.
 */
function mergeRuntime(
  ...layers: (RuntimeConfig | undefined)[]
): RuntimeConfig {
  const result: RuntimeConfig = {
    transport: 'fetch',
    defaultHeaders: {},
    responseTypeHints: true,
  };

  for (const layer of layers) {
    if (!layer) {
      continue;
    }

    if (layer.transport !== undefined) {
      result.transport = layer.transport;
    }

    if (layer.defaultHeaders) {
      result.defaultHeaders = {
        ...result.defaultHeaders,
        ...layer.defaultHeaders,
      };
    }

    if (layer.responseTypeHints !== undefined) {
      result.responseTypeHints = layer.responseTypeHints;
    }
  }

  return result;
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

  const runtime = config.runtime;

  if (runtime?.defaultHeaders !== undefined) {
    if (
      typeof runtime.defaultHeaders !== 'object' ||
      runtime.defaultHeaders === null ||
      Array.isArray(runtime.defaultHeaders)
    ) {
      throw new Error(
        'Invalid runtime.defaultHeaders: must be an object of string keys to string values.',
      );
    }

    for (const [key, value] of Object.entries(runtime.defaultHeaders)) {
      if (typeof value !== 'string') {
        throw new Error(
          `Invalid runtime.defaultHeaders: value for '${key}' must be a string, got ${typeof value}.`,
        );
      }
    }
  }

  if (
    runtime?.responseTypeHints !== undefined &&
    typeof runtime.responseTypeHints !== 'boolean'
  ) {
    throw new Error(
      'Invalid runtime.responseTypeHints: must be a boolean.',
    );
  }

  if (
    runtime?.transport !== undefined &&
    runtime.transport !== 'fetch' &&
    runtime.transport !== 'httpClient'
  ) {
    throw new Error(
      `Invalid runtime.transport: '${runtime.transport}'. Must be 'fetch' or 'httpClient'.`,
    );
  }
}

/**
 * Type guard for the `GroupBy` union.
 */
export function isGroupBy(value: unknown): value is GroupBy {
  return value === 'tag' || value === 'path';
}

/**
 * Type guard for the `HttpTransport` union.
 */
export function isTransport(value: unknown): value is HttpTransport {
  return value === 'fetch' || value === 'httpClient';
}