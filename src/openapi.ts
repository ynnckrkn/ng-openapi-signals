import SwaggerParser from '@apidevtools/swagger-parser';

export async function loadOpenApi(input: string): Promise<any> {
  // Use `bundle` instead of `dereference` so that $ref pointers to
  // components/schemas are preserved. This lets schemaToTsType extract
  // the referenced model name (e.g. "User") instead of an inlined
  // `Record<string, unknown>` after dereferencing.
  const api = await SwaggerParser.bundle(input);

  if (!api || typeof api !== 'object') {
    throw new Error('Invalid OpenAPI document.');
  }

  if (!('paths' in api)) {
    throw new Error('OpenAPI document has no paths.');
  }

  return api;
}
