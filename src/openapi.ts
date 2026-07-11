import SwaggerParser from '@apidevtools/swagger-parser';
import {existsSync} from 'node:fs';

export async function loadOpenApi(input: string): Promise<any> {
  if (!existsSync(input)) {
    throw new Error(
      `OpenAPI input file not found: '${input}'. Check the --input path or the 'input' field in your config file.`,
    );
  }

  let api: any;

  try {
    // Use `bundle` instead of `dereference` so that $ref pointers to
    // components/schemas are preserved. This lets schemaToTsType extract
    // the referenced model name (e.g. "User") instead of an inlined
    // `Record<string, unknown>` after dereferencing.
    api = await SwaggerParser.bundle(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to parse OpenAPI document '${input}': ${reason}`,
      {cause: error},
    );
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
