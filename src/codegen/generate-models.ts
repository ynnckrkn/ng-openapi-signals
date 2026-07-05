import type {SchemaModel} from './types';
import {kebabCase} from './naming';
import {schemaToTsType} from './schema-to-ts';

export function extractSchemas(api: any): SchemaModel[] {
  const schemas = api.components?.schemas ?? {};

  return Object.entries(schemas).map(([name, schema]: [string, any]) => {
    return extractSchemaModel(name, schema);
  });
}

function extractSchemaModel(name: string, schema: any): SchemaModel {
  // Enum schema → named union type
  if (schema.enum) {
    return {
      name,
      kind: 'enum',
      properties: [],
      values: schema.enum as (string | number)[],
      enumNames: schema['x-enumNames'] ?? schema['x-enum-varnames'],
    };
  }

  // Composition-only schemas (allOf/oneOf/anyOf) without properties → type alias
  if (!schema.properties && (schema.allOf || schema.oneOf || schema.anyOf)) {
    return {
      name,
      kind: 'alias',
      properties: [],
      aliasType: schemaToTsType(schema),
    };
  }

  // Primitive type alias (string/integer/number/boolean without properties/enum)
  if (schema.type && schema.type !== 'object' && !schema.properties && !schema.enum) {
    return {
      name,
      kind: 'alias',
      properties: [],
      aliasType: schemaToTsType(schema),
    };
  }

  // Object schema → interface
  const required = new Set<string>(schema.required ?? []);
  const properties = schema.properties ?? {};

  return {
    name,
    kind: 'interface',
    properties: Object.entries(properties).map(
      ([propertyName, propertySchema]: [string, any]) => ({
        name: propertyName,
        type: schemaToTsType(propertySchema),
        required: required.has(propertyName),
      }),
    ),
  };
}

export function generateModelFiles(schemas: SchemaModel[]): Record<string, string> {
  const files: Record<string, string> = {};
  const schemaNames = new Set(schemas.map((s) => s.name));

  for (const schema of schemas) {
    if (schema.kind === 'enum') {
      files[`models/${kebabCase(schema.name)}.ts`] = generateEnumType(schema, schemaNames);
    } else if (schema.kind === 'alias') {
      files[`models/${kebabCase(schema.name)}.ts`] = generateAliasType(schema, schemaNames);
    } else {
      files[`models/${kebabCase(schema.name)}.ts`] = generateInterface(schema, schemaNames);
    }
  }

  files['models/index.ts'] =
    schemas.map((schema) => `export * from './${kebabCase(schema.name)}';`).join('\n') + '\n';

  return files;
}

function generateEnumType(schema: SchemaModel, allSchemaNames: Set<string>): string {
  const values = (schema.values ?? []).map((v) => JSON.stringify(v)).join(' | ');
  const imports = collectModelImportsForType(values, allSchemaNames, schema.name);

  return `${imports}export type ${schema.name} = ${values};
`;
}

function generateAliasType(schema: SchemaModel, allSchemaNames: Set<string>): string {
  const aliasType = schema.aliasType ?? 'unknown';
  const imports = collectModelImportsForType(aliasType, allSchemaNames, schema.name);

  return `${imports}export type ${schema.name} = ${aliasType};
`;
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

function collectModelImportsForType(
  type: string,
  allSchemaNames: Set<string>,
  selfName: string,
): string {
  const types = new Set<string>();
  collectType(type, types, allSchemaNames);
  types.delete(selfName);

  if (types.size === 0) {
    return '';
  }

  return `import { ${Array.from(types).sort().join(', ')} } from './index';\n\n`;
}

export function collectType(type: string, output: Set<string>, schemaNames: Set<string>): void {
  if (!type) {
    return;
  }

  if (type.endsWith('[]')) {
    collectType(type.slice(0, -2), output, schemaNames);
    return;
  }

  if (type.startsWith('Record<string, ') && type.endsWith('>')) {
    const inner = type.slice('Record<string, '.length, -1);
    collectType(inner, output, schemaNames);
    return;
  }

  if (type.includes(' | ') || type.includes(' & ')) {
    for (const part of type.split(/[ |&]+/)) {
      collectType(part.trim(), output, schemaNames);
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
