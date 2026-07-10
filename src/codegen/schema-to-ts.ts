/**
 * Convert an OpenAPI schema object to a TypeScript type string.
 *
 * Supports:
 * - `$ref` → referenced model name
 * - `enum` → inline literal union
 * - `nullable: true` (OpenAPI 3.0) and `type: [x, 'null']` (OpenAPI 3.1)
 * - `allOf` / `oneOf` / `anyOf` composition
 * - `additionalProperties` → `Record<string, T>`
 * - inline anonymous object schemas → inline TS object type literal
 * - `prefixItems` (OpenAPI 3.1) → tuple types
 * - arrays, primitives
 */
export function schemaToTsType(schema: any): string {
  if (!schema) {
    return 'unknown';
  }

  // Composition keywords take precedence when there is no `type` / `enum` / `$ref`.
  if (schema.allOf) {
    const parts = schema.allOf.map((sub: any) => schemaToTsType(sub));
    return withNullable(parts.filter((p: string) => p && p !== 'unknown').join(' & '), schema);
  }

  if (schema.oneOf || schema.anyOf) {
    const subs = (schema.oneOf ?? schema.anyOf) as any[];
    const parts = subs.map((sub: any) => schemaToTsType(sub));
    return withNullable(parts.filter((p: string) => p && p !== 'unknown').join(' | '), schema);
  }

  if (schema.$ref) {
    return withNullable(schema.$ref.split('/').pop() ?? 'unknown', schema);
  }

  if (Array.isArray(schema.type)) {
    const types = schema.type
      .filter((type: string) => type !== 'null')
      .map((type: string) => schemaToTsType({...schema, type}));

    if (schema.type.includes('null')) {
      types.push('null');
    }

    return Array.from(new Set(types)).join(' | ');
  }

  if (schema.enum) {
    return withNullable(
      schema.enum.map((value: unknown) => JSON.stringify(value)).join(' | '),
      schema,
    );
  }

  switch (schema.type) {
    case 'array':
      return withNullable(arrayToTsType(schema), schema);

    case 'integer':
    case 'number':
      return withNullable('number', schema);

    case 'boolean':
      return withNullable('boolean', schema);

    case 'string':
      if (schema.format === 'binary') {
        return withNullable('Blob', schema);
      }
      return withNullable('string', schema);

    case 'object':
      return withNullable(objectToTsType(schema), schema);

    default:
      // No explicit type — try to infer from keywords.
      if (schema.properties || schema.additionalProperties) {
        return withNullable(objectToTsType(schema), schema);
      }

      return 'unknown';
  }
}

/**
 * Wrap a type in `| null` when the schema is nullable.
 *
 * Handles both OpenAPI 3.0 (`nullable: true`) and OpenAPI 3.1
 * (`type: ['string', 'null']` — but that case is already split by the caller).
 */
function withNullable(type: string, schema: any): string {
  if (!type || type === 'unknown') {
    return type;
  }

  if (type.endsWith(' | null') || type === 'null') {
    return type;
  }

  if (schema.nullable === true) {
    return `${type} | null`;
  }

  return type;
}

/**
 * Convert an `array` schema to a TS type string.
 *
 * Supports:
 * - `items` as a single schema → `T[]`
 * - `prefixItems` (OpenAPI 3.1) → tuple `[A, B, C]`
 */
function arrayToTsType(schema: any): string {
  if (schema.prefixItems) {
    const tuple = schema.prefixItems.map((sub: any) => schemaToTsType(sub)).join(', ');
    return `[${tuple}]`;
  }

  const inner = schemaToTsType(schema.items);
  // Wrap unions/intersections in parentheses so `[]` binds to the whole type,
  // not just the last member (e.g. `('A' | 'B' | 'C')[]` instead of `'A' | 'B' | 'C'[]`).
  const wrapped = / \| | & /.test(inner) && !inner.startsWith('(') ? `(${inner})` : inner;
  return `${wrapped}[]`;
}

/**
 * Convert an `object` schema to a TS type string.
 *
 * Supports:
 * - `properties` + `required` → inline object type literal
 * - `additionalProperties: { schema }` → `Record<string, T>`
 * - `additionalProperties: true` → `Record<string, unknown>`
 * - empty object → `Record<string, unknown>`
 */
function objectToTsType(schema: any): string {
  const properties = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);
  const propertyNames = Object.keys(properties);

  // additionalProperties as a schema → Record<string, T>
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const valueType = schemaToTsType(schema.additionalProperties);
    return `Record<string, ${valueType}>`;
  }

  // No properties and additionalProperties: true (or unspecified) → open record
  if (propertyNames.length === 0) {
    return 'Record<string, unknown>';
  }

  // Build an inline object type literal
  const members = propertyNames
    .map((name) => {
      const optional = required.has(name) ? '' : '?';
      const type = schemaToTsType(properties[name]);
      return `${name}${optional}: ${type}`;
    })
    .join('; ');

  return `{ ${members} }`;
}
