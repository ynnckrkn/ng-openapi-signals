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
  const schemaNames = new Set(schemas.map((s) => s.name));

  for (const schema of schemas) {
    files[`models/${kebabCase(schema.name)}.ts`] = generateInterface(schema, schemaNames);
  }

  files['models/index.ts'] =
    schemas.map((schema) => `export * from './${kebabCase(schema.name)}';`).join('\n') + '\n';

  return files;
}

function generateInterface(schema: SchemaModel, allSchemaNames: Set<string>): string {
  const properties = schema.properties
    .map((property) => {
      const optional = property.required ? '' : '?';
      return `  ${property.name}${optional}: ${property.type};`;
    })
    .join('\n');

  const imports = collectModelImportsForSchema(schema, allSchemaNames);

  return `${imports}export interface ${schema.name} {
${properties}
}
`;
}

function collectModelImportsForSchema(schema: SchemaModel, allSchemaNames: Set<string>): string {
  const types = new Set<string>();

  for (const property of schema.properties) {
    collectType(property.type, types, allSchemaNames);
  }

  // Don't import yourself
  types.delete(schema.name);

  if (types.size === 0) {
    return '';
  }

  return `import { ${Array.from(types).sort().join(', ')} } from './index';\n\n`;
}

function collectType(type: string, output: Set<string>, schemaNames: Set<string>): void {
  if (!type) {
    return;
  }

  if (type.endsWith('[]')) {
    collectType(type.slice(0, -2), output, schemaNames);
    return;
  }

  if (type.includes(' | ')) {
    for (const part of type.split(' | ')) {
      collectType(part, output, schemaNames);
    }
    return;
  }

  if (type.startsWith('"') || type.startsWith("'")) {
    return;
  }

  if (schemaNames.has(type)) {
    output.add(type);
  }
}
