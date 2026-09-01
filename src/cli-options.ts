import type {PartialGeneratorConfig, RuntimeConfig} from './codegen/types';
import {isGroupBy, isQueryStyle, isTransport} from './config';

/**
 * Raw `generate` command option values as passed by commander.
 *
 * Strings for enum-like options are validated here before they are promoted
 * to the typed `PartialGeneratorConfig`; invalid values are dropped so that
 * file-config values (and defaults) remain in effect.
 */
export interface CliGenerateOptions {
  input?: string;
  output?: string;
  clean?: boolean;
  groupBy?: string;
  transport?: string;
  defaultQueryStyle?: string;
  defaultQueryExplode?: string;
  preferContentType?: string;
  signalMutations?: boolean;
  dateTransformer?: boolean;
}

/**
 * Converts raw CLI option values into a `PartialGeneratorConfig` that can be
 * merged over the file config via `resolveConfig`.
 *
 * All `runtime.*` flags are collected into a **single** `runtime` object.
 * Spreading multiple `{runtime: {...}}` fragments instead would make later
 * fragments silently discard earlier ones (last spread wins), losing flags
 * like `--transport httpClient --signal-mutations --date-transformer`.
 */
export function buildCliConfig(options: CliGenerateOptions): PartialGeneratorConfig {
  const runtime: Partial<RuntimeConfig> = {
    ...(options.transport !== undefined && isTransport(options.transport)
      ? {transport: options.transport}
      : {}),
    ...(options.defaultQueryStyle !== undefined && isQueryStyle(options.defaultQueryStyle)
      ? {defaultQueryStyle: options.defaultQueryStyle}
      : {}),
    ...(options.defaultQueryExplode !== undefined
      ? {defaultQueryExplode: options.defaultQueryExplode === 'true'}
      : {}),
    ...(options.preferContentType !== undefined
      ? {preferContentType: options.preferContentType}
      : {}),
    ...(options.signalMutations === true ? {signalMutations: true} : {}),
    ...(options.dateTransformer === true ? {dateTransformer: true} : {}),
  };

  return {
    ...(options.input ? {input: options.input} : {}),
    ...(options.output ? {output: options.output} : {}),
    ...(options.clean !== undefined ? {clean: options.clean} : {}),
    ...(options.groupBy !== undefined && isGroupBy(options.groupBy) ? {groupBy: options.groupBy} : {}),
    ...(Object.keys(runtime).length > 0 ? {runtime} : {}),
  };
}