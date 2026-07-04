import type {SchemaModel} from './types';
import {kebabCase} from './naming';
import {schemaToTsType} from './schema-to-ts';

export function extractSchemas(api: any): SchemaModel[] {
  const schemas = api.components?.schemas ?? {};

  return Object.entries(schemas).map(([name, schema]: [string, any]) => {
    const required = new Set<string>(schema.required ?? []);
    const properties = schema.properties ?? {};

    return {
      name,
      properties: Object.entries(properties).map(
        ([propertyName, propertySchema]: [string, any]) => ({
          name: propertyName,
          type: schemaToTsType(propertySchema),
          required: required.has(propertyName),
        }),
      ),
    };
  });
}

export function generateModelFiles(schemas: SchemaModel[]): Record<string, string> {
  const files: Record<string, string> = {};

  for (const schema of schemas) {
    files[`models/${kebabCase(schema.name)}.ts`] = generateInterface(schema);
  }

  files['models/index.ts'] =
    schemas.map((schema) => `export * from './${kebabCase(schema.name)}';`).join('\n') + '\n';

  return files;
}

function generateInterface(schema: SchemaModel): string {
  const properties = schema.properties
    .map((property) => {
      const optional = property.required ? '' : '?';
      return `  ${property.name}${optional}: ${property.type};`;
    })
    .join('\n');

  return `export interface ${schema.name} {
${properties}
}
`;
}
