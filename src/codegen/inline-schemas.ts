import {pascalCase} from './naming';

/**
 * Walks an OpenAPI document and hoists anonymous object schemas into
 * `components.schemas` with auto-generated names.
 *
 * After this pass, every inline object schema that has `properties` or a typed
 * `additionalProperties` is replaced by a `$ref` pointing at a newly created
 * `components.schemas.<Name>` entry. This lets the rest of the generator treat
 * them uniformly via the existing `$ref` handling.
 *
 * Naming strategy:
 * - Property of a named schema: `<ParentSchema><PropertyName>` (e.g. `UserAddress`)
 * - Response body of an operation: `<operationId>Response` (e.g. `getUserByIdResponse`)
 * - Request body of an operation: `<operationId>Request` (e.g. `createUserRequest`)
 * - Parameter: `<operationId><ParamName>` (e.g. `searchUsersLimit`)
 * - Fallback: `InlineSchema`, `InlineSchema2`, ...
 */
export function hoistInlineSchemas(api: any): void {
  // Ensure components.schemas exists before referencing it.
  if (!api.components) {
    api.components = {};
  }

  if (!api.components.schemas) {
    api.components.schemas = {};
  }

  const usedNames = new Set<string>(Object.keys(api.components.schemas));
  const schemaRegistry = api.components.schemas;

  function registerName(base: string): string {
    let name = pascalCase(base);
    if (!name) {
      name = 'InlineSchema';
    }

    let candidate = name;
    let counter = 2;
    while (usedNames.has(candidate)) {
      candidate = `${name}${counter}`;
      counter++;
    }

    usedNames.add(candidate);
    return candidate;
  }

  function isHoistable(schema: any): boolean {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    // Already a ref — nothing to hoist.
    if (schema.$ref) {
      return false;
    }

    // Enum schemas are inlined as literal unions; no need to hoist.
    if (schema.enum) {
      return false;
    }

    // Composition-only schemas (allOf/oneOf/anyOf) without type — hoist if they
    // produce something other than `unknown`.
    if (schema.allOf || schema.oneOf || schema.anyOf) {
      return true;
    }

    // Only hoist structured objects (with `properties`).
    // Objects that are pure maps (additionalProperties-only) are handled inline
    // by schemaToTsType as `Record<string, T>`.
    if (
      (schema.type === 'object' || !schema.type) &&
      schema.properties &&
      Object.keys(schema.properties).length > 0
    ) {
      return true;
    }

    return false;
  }

  function hoist(schema: any, nameHint: string): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // Recurse into composition keywords first so nested inline objects get hoisted.
    if (schema.allOf) {
      schema.allOf = schema.allOf.map((sub: any, i: number) =>
        hoist(sub, `${nameHint}Item${i}`),
      );
    }

    if (schema.oneOf) {
      schema.oneOf = schema.oneOf.map((sub: any, i: number) =>
        hoist(sub, `${nameHint}Variant${i}`),
      );
    }

    if (schema.anyOf) {
      schema.anyOf = schema.anyOf.map((sub: any, i: number) =>
        hoist(sub, `${nameHint}Variant${i}`),
      );
    }

    // Recurse into array items.
    if (schema.items) {
      schema.items = hoist(schema.items, `${nameHint}Item`);
    }

    if (schema.prefixItems) {
      schema.prefixItems = schema.prefixItems.map((sub: any, i: number) =>
        hoist(sub, `${nameHint}Item${i}`),
      );
    }

    // Recurse into additionalProperties.
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      schema.additionalProperties = hoist(schema.additionalProperties, `${nameHint}Value`);
    }

    // Recurse into object properties.
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        schema.properties[propName] = hoist(propSchema as any, `${nameHint}${pascalCase(propName)}`);
      }
    }

    // Now decide whether this schema itself should be hoisted.
    if (isHoistable(schema)) {
      const name = registerName(nameHint);
      // Deep clone so the registered schema is independent of the reference site.
      const cloned = structuredClone(schema);
      schemaRegistry[name] = cloned;
      return {$ref: `#/components/schemas/${name}`};
    }

    return schema;
  }

  // Walk named schemas — hoist their inline property schemas.
  for (const [schemaName, schema] of Object.entries(api.components.schemas)) {
    const s = schema as any;
    if (s && s.properties) {
      for (const [propName, propSchema] of Object.entries(s.properties)) {
        s.properties[propName] = hoist(propSchema as any, `${schemaName}${pascalCase(propName)}`);
      }
    }

    if (s && s.allOf) {
      s.allOf = s.allOf.map((sub: any, i: number) => hoist(sub, `${schemaName}Item${i}`));
    }

    if (s && s.oneOf) {
      s.oneOf = s.oneOf.map((sub: any, i: number) => hoist(sub, `${schemaName}Variant${i}`));
    }

    if (s && s.anyOf) {
      s.anyOf = s.anyOf.map((sub: any, i: number) => hoist(sub, `${schemaName}Variant${i}`));
    }

    if (s && s.items) {
      s.items = hoist(s.items, `${schemaName}Item`);
    }

    if (s && s.additionalProperties && typeof s.additionalProperties === 'object') {
      s.additionalProperties = hoist(s.additionalProperties, `${schemaName}Value`);
    }
  }

  // Walk paths — hoist inline schemas in parameters, request bodies, responses.
  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    const item = pathItem as any;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of methods) {
      const operation = item[method];
      if (!operation) {
        continue;
      }

      const operationId = operation.operationId ?? fallbackOperationName(method, path);

      // Parameters
      for (const param of operation.parameters ?? []) {
        if (param.schema) {
          param.schema = hoist(param.schema, `${operationId}${pascalCase(param.name)}`);
        }
      }

      // Request body
      if (operation.requestBody?.content) {
        for (const content of Object.values(operation.requestBody.content)) {
          const c = content as any;
          if (c.schema) {
            c.schema = hoist(c.schema, `${operationId}Request`);
          }
        }
      }

      // Responses
      for (const response of Object.values(operation.responses ?? {})) {
        const resp = response as any;
        if (resp.content) {
          for (const content of Object.values(resp.content)) {
            const c = content as any;
            if (c.schema) {
              c.schema = hoist(c.schema, `${operationId}Response`);
            }
          }
        }
      }
    }

    // Path-level parameters
    for (const param of item.parameters ?? []) {
      if (param.schema) {
        const hint = `${pathGroupName(path)}${pascalCase(param.name)}`;
        param.schema = hoist(param.schema, hint);
      }
    }
  }
}

function pathGroupName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return pascalCase(segments[0] ?? 'Default');
}

function fallbackOperationName(method: string, path: string): string {
  const segments = path.split('/').filter(Boolean);
  const parts = segments.map((seg) => seg.replace(/[{}]/g, ''));
  return `${method}${parts.map((p) => pascalCase(p)).join('')}`;
}