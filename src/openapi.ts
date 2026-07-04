import SwaggerParser from '@apidevtools/swagger-parser';

export async function loadOpenApi(input: string): Promise<any> {
  const api = await SwaggerParser.dereference(input);

  if (!api || typeof api !== 'object') {
    throw new Error('Invalid OpenAPI document.');
  }

  if (!('paths' in api)) {
    throw new Error('OpenAPI document has no paths.');
  }

  return api;
}
