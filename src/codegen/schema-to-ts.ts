export function schemaToTsType(schema: any): string {
  if (!schema) {
    return 'unknown';
  }

  if (schema.$ref) {
    return schema.$ref.split('/').pop() ?? 'unknown';
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
    return schema.enum.map((value: unknown) => JSON.stringify(value)).join(' | ');
  }

  switch (schema.type) {
    case 'array':
      return `${schemaToTsType(schema.items)}[]`;

    case 'integer':
    case 'number':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'string':
      return 'string';

    case 'object':
      return 'Record<string, unknown>';

    default:
      return 'unknown';
  }
}
