import SwaggerParser from '@apidevtools/swagger-parser';
import type {OpenAPI} from 'openapi-types';
import {existsSync} from 'node:fs';

/**
 * A schema object from an OpenAPI 3.x document.
 *
 * This is a permissive interface covering the fields used by the codegen.
 * OpenAPI 3.0 and 3.1 differ in some details (e.g. `type` can be an array in
 * 3.1, `nullable` exists only in 3.0), so we keep the shape loose rather than
 * matching the exact discriminated union from `openapi-types`.
 */
export interface OpenAPISchema {
  $ref?: string;
  type?: string | string[];
  format?: string;
  nullable?: boolean;
  enum?: unknown[];
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  items?: OpenAPISchema;
  prefixItems?: OpenAPISchema[];
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: OpenAPISchema | boolean;
  /** Custom enum member names (OpenAPI extension). */
  'x-enumNames'?: string[];
  /** Custom enum variable names (OpenAPI extension). */
  'x-enum-varnames'?: string[];
}

export async function loadOpenApi(input: string): Promise<OpenAPI.Document> {
  if (!existsSync(input)) {
    throw new Error(
      `OpenAPI input file not found: '${input}'. Check the --input path or the 'input' field in your config file.`,
    );
  }

  let api: OpenAPI.Document | undefined;

  try {
    // Use `bundle` instead of `dereference` so that $ref pointers to
    // components/schemas are preserved. This lets schemaToTsType extract
    // the referenced model name (e.g. "User") instead of an inlined
    // `Record<string, unknown>` after dereferencing.
    api = await SwaggerParser.bundle(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to parse OpenAPI document '${input}': ${reason}`, {cause: error});
  }

  if (!api || typeof api !== 'object') {
    throw new Error(
      `Invalid OpenAPI document '${input}': the file does not contain a valid object.`,
    );
  }

  if (!('paths' in api)) {
    throw new Error(
      `Invalid OpenAPI document '${input}': no 'paths' field found. Ensure the file is a valid OpenAPI 3.x specification.`,
    );
  }

  return api;
}
