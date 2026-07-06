import type {GeneratorConfig, HttpMethod, OperationModel, ParameterModel} from './types';
import {camelCase, kebabCase, pascalCase, serviceNameFromTag} from './naming';
import {schemaToTsType} from './schema-to-ts';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

export function extractOperations(api: any): OperationModel[] {
  const operations: OperationModel[] = [];

  for (const [path, pathItem] of Object.entries(api.paths ?? {}) as [string, any][]) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!operation) {
        continue;
      }

      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];

      const pathParams = parameters
        .filter((parameter: any) => parameter.in === 'path')
        .map(toParameterModel);

      const queryParams = parameters
        .filter((parameter: any) => parameter.in === 'query')
        .map(toParameterModel);

      const requestBodyType = extractRequestBodyType(operation);
      const {responseType, responseParser} = extractResponseType(operation);

      operations.push({
        operationId: operation.operationId ?? fallbackOperationId(method, path),
        tag: operation.tags?.[0] ?? 'Default',
        method,
        path,
        pathParams,
        queryParams,
        responseType,
        ...(responseParser ? {responseParser} : {}),
        ...(requestBodyType ? {requestBodyType} : {}),
      });
    }
  }

  return operations;
}

export function generateApiFiles(
  operations: OperationModel[],
  config: GeneratorConfig,
): Record<string, string> {
  const files: Record<string, string> = {};
  const grouped =
    config.groupBy === 'path' ? groupByPath(operations) : groupByTag(operations);

  for (const [group, groupOperations] of Object.entries(grouped)) {
    files[`resources/${kebabCase(group)}.api.ts`] = generateService(
      serviceNameFromTag(group),
      groupOperations,
      config,
    );
  }

  files['resources/index.ts'] =
    Object.keys(grouped)
      .map((group) => `export * from './${kebabCase(group)}.api';`)
      .join('\n') + '\n';

  return files;
}

function generateService(
  serviceName: string,
  operations: OperationModel[],
  config: GeneratorConfig,
): string {
  const modelImports = collectModelImports(operations);
  const hasGets = operations.some((op) => op.method === 'get');
  const hasGetsWithParams = operations.some(
    (op) => op.method === 'get' && op.pathParams.length + op.queryParams.length > 0,
  );
  const responseTypeHints = config.runtime?.responseTypeHints ?? true;
  const transport = config.runtime?.transport ?? 'fetch';
  const clientClassName = transport === 'httpClient' ? 'ApiHttpClient' : 'ApiFetchClient';
  const clientImportPath =
    transport === 'httpClient' ? '../api-http-client' : '../api-fetch-client';

  const angularImports = ['Service', 'inject'];
  if (hasGets) {
    angularImports.push('resource');
  }

  const signalUtilImport =
    hasGetsWithParams
      ? `import { MaybeSignal, readSignalOrValue } from '../signal-utils';\n`
      : '';
  const modelImportLine = modelImports ? `${modelImports}\n` : '';

  const methods = operations
    .map((operation) => {
      if (operation.method === 'get') {
        return generateResourceMethod(operation, responseTypeHints);
      }

      return generateMutationMethod(operation, responseTypeHints);
    })
    .join('\n\n');

  return `import { ${angularImports.join(', ')} } from '@angular/core';
import { ${clientClassName} } from '${clientImportPath}';
${signalUtilImport}${modelImportLine}
@Service()
export class ${serviceName} {
  private readonly client = inject(${clientClassName});

${methods}
}
`;
}

function generateResourceMethod(operation: OperationModel, responseTypeHints: boolean): string {
  const hasParams = operation.pathParams.length + operation.queryParams.length > 0;
  const paramsType = generateParamsType(operation);
  const resourceParamsType = generateResolvedParamsType(operation);
  const paramsExpression = generateResourceParamsExpression(operation);
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);
  const paramsArg = hasParams ? `params: ${paramsType}` : '';
  const paramsFactory = hasParams
    ? `params: (): ${resourceParamsType} => (${paramsExpression}),`
    : '';

  const requestLines = [
    `method: '${operation.method.toUpperCase()}',`,
    `path: ${pathExpression},`,
  ];

  if (queryExpression) {
    requestLines.push(`query: ${queryExpression},`);
  }

  if (responseTypeHints && operation.responseParser) {
    requestLines.push(`responseType: '${operation.responseParser}',`);
  }

  requestLines.push('signal: abortSignal');
  const requestBody = requestLines.map((line) => `          ${line}`).join('\n');

  return `  ${operation.operationId}Resource(${paramsArg}) {
    return resource({
      ${paramsFactory}
      loader: ({ params, abortSignal }: { params: ${resourceParamsType}; abortSignal: AbortSignal }) =>
        this.client.request<${operation.responseType}>({
${requestBody}
        })
    });
  }`;
}

function generateResolvedParamsType(operation: OperationModel): string {
  const params = [...operation.pathParams, ...operation.queryParams];

  if (params.length === 0) {
    return 'undefined';
  }

  const properties = params
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `    ${param.name}${optional}: ${param.type};`;
    })
    .join('\n');

  return `{
${properties}
  }`;
}

function generateMutationMethod(operation: OperationModel, responseTypeHints: boolean): string {
  const hasParams = operation.pathParams.length + operation.queryParams.length > 0;
  const paramsType = generateParamsType(operation);
  const bodyParameter = operation.requestBodyType ? `body: ${operation.requestBodyType}, ` : '';
  const paramsParameter = hasParams ? `params: ${paramsType}, ` : '';
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);

  const requestLines = [
    `method: '${operation.method.toUpperCase()}',`,
    `path: ${pathExpression},`,
  ];

  if (queryExpression) {
    requestLines.push(`query: ${queryExpression},`);
  }

  if (operation.requestBodyType) {
    requestLines.push('body,');
  }

  if (responseTypeHints && operation.responseParser) {
    requestLines.push(`responseType: '${operation.responseParser}',`);
  }

  requestLines.push('signal');
  const requestBody = requestLines.map((line) => `      ${line}`).join('\n');

  return `  ${operation.operationId}(${bodyParameter}${paramsParameter}signal?: AbortSignal): Promise<${operation.responseType}> {
    return this.client.request<${operation.responseType}>({
${requestBody}
    });
  }`;
}

function generateParamsType(operation: OperationModel): string {
  const params = [...operation.pathParams, ...operation.queryParams];

  if (params.length === 0) {
    return 'void';
  }

  const properties = params
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `    ${param.name}${optional}: MaybeSignal<${param.type}>;`;
    })
    .join('\n');

  return `{
${properties}
  }`;
}

function generateResourceParamsExpression(operation: OperationModel): string {
  const params = [...operation.pathParams, ...operation.queryParams];

  if (params.length === 0) {
    return 'undefined';
  }

  const properties = params
    .map((param) => `        ${param.name}: readSignalOrValue(params.${param.name})`)
    .join(',\n');

  return `{
${properties}
      }`;
}

function generatePathExpression(operation: OperationModel): string {
  const hasParams = [...operation.pathParams, ...operation.queryParams].length > 0;

  if (!hasParams) {
    return `'${operation.path}'`;
  }

  const templatePath = operation.path.replace(
    /{([^}]+)}/g,
    (_, name) => `\${encodeURIComponent(String(params.${name}))}`,
  );

  return '`' + templatePath + '`';
}

function generateQueryExpression(operation: OperationModel): string {
  if (operation.queryParams.length === 0) {
    return '';
  }

  const properties = operation.queryParams
    .map((param) => `            ${param.name}: params.${param.name}`)
    .join(',\n');

  return `{
${properties}
          }`;
}

function toParameterModel(parameter: any): ParameterModel {
  return {
    name: parameter.name,
    location: parameter.in,
    required: Boolean(parameter.required),
    type: schemaToTsType(parameter.schema),
  };
}

function extractResponseType(operation: any): {
  responseType: string;
  responseParser?: 'json' | 'text' | 'blob' | 'arrayBuffer';
} {
  const responses = operation.responses ?? {};

  // Collect all 2xx response schemas (including 2XX range from OpenAPI 3.1).
  const successSchemas: string[] = [];
  let responseParser: 'json' | 'text' | 'blob' | 'arrayBuffer' | undefined;

  for (const [statusCode, response] of Object.entries(responses)) {
    if (!isSuccessStatus(statusCode)) {
      continue;
    }

    const {schema, contentType} = extractSchemaFromResponse(response);

    // 204 / no content → void; skip adding to the union.
    if (!schema || schema === 'void') {
      continue;
    }

    successSchemas.push(schema);

    // Use the first success response's content type to derive the parser hint.
    if (!responseParser && contentType) {
      responseParser = parserForContentType(contentType);
    }
  }

  if (successSchemas.length === 0) {
    return {responseType: 'void'};
  }

  // Deduplicate while preserving order.
  const unique = Array.from(new Set(successSchemas));

  const responseType = unique.length === 1 ? unique[0]! : unique.join(' | ');

  return {
    responseType,
    ...(responseParser ? {responseParser} : {}),
  };
}

/** Maps an HTTP content-type to a runtime response parser hint. */
function parserForContentType(
  contentType: string,
): 'json' | 'text' | 'blob' | 'arrayBuffer' | undefined {
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return 'json';
  }

  if (contentType.startsWith('text/')) {
    return 'text';
  }

  // Binary content types → Blob by default.
  if (
    contentType.startsWith('image/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('video/') ||
    contentType === 'application/octet-stream' ||
    contentType.startsWith('multipart/')
  ) {
    return 'blob';
  }

  return undefined;
}

function isSuccessStatus(statusCode: string): boolean {
  if (statusCode === 'default') {
    return false;
  }

  // Exact 2xx codes: 200, 201, ...
  if (/^2\d\d$/.test(statusCode)) {
    return true;
  }

  // OpenAPI 3.1 range: 2XX
  if (/^2XX$/i.test(statusCode)) {
    return true;
  }

  return false;
}

function extractSchemaFromResponse(response: any): {
  schema?: string;
  contentType?: string;
} {
  if (!response?.content) {
    return {};
  }

  // Prefer application/json, then any JSON-like content type, then */*.
  const entries = Object.entries(response.content) as [string, any][];

  const jsonEntry = entries.find(([type]) => type === 'application/json');
  const jsonLikeEntry = entries.find(
    ([type, c]) => type !== 'application/json' && type !== '*/*' && c?.schema,
  );
  const wildcardEntry = entries.find(([type]) => type === '*/*');

  const chosen = jsonEntry ?? jsonLikeEntry ?? wildcardEntry;

  if (!chosen) {
    return {};
  }

  const [contentType, content] = chosen;
  const schema = content?.schema;

  if (!schema) {
    return {contentType};
  }

  return {schema: schemaToTsType(schema), contentType};
}

function extractRequestBodyType(operation: any): string | undefined {
  const content = operation.requestBody?.content;
  if (!content) {
    return undefined;
  }

  const jsonContent = content['application/json'] ?? Object.values(content).find((c: any) => c?.schema) as any | undefined;
  const schema = jsonContent?.schema;

  if (!schema) {
    return undefined;
  }

  return schemaToTsType(schema);
}

function groupByTag(operations: OperationModel[]): Record<string, OperationModel[]> {
  return operations.reduce<Record<string, OperationModel[]>>((result, operation) => {
    const tagOperations = result[operation.tag] ?? [];
    tagOperations.push(operation);
    result[operation.tag] = tagOperations;
    return result;
  }, {});
}

function groupByPath(operations: OperationModel[]): Record<string, OperationModel[]> {
  return operations.reduce<Record<string, OperationModel[]>>((result, operation) => {
    const group = pathGroupName(operation.path);
    const groupOperations = result[group] ?? [];
    groupOperations.push(operation);
    result[group] = groupOperations;
    return result;
  }, {});
}

function pathGroupName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[0] ?? 'Default';
}

function fallbackOperationId(method: HttpMethod, path: string): string {
  const segments = path.split('/').filter(Boolean);
  const methodPrefix = methodVerbPrefix(method);
  const nameParts: string[] = [methodPrefix];

  for (const segment of segments) {
    const paramMatch = segment.match(/^\{(.+)\}$/);

    if (paramMatch) {
      nameParts.push('By', pascalCase(paramMatch[1]!));
    } else {
      nameParts.push(pascalCase(segment));
    }
  }

  return camelCase(nameParts.join(''));
}

function methodVerbPrefix(method: HttpMethod): string {
  switch (method) {
    case 'get':
      return 'get';
    case 'post':
      return 'create';
    case 'put':
    case 'patch':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return method;
  }
}

function collectModelImports(operations: OperationModel[]): string {
  const types = new Set<string>();

  for (const operation of operations) {
    collectType(operation.responseType, types);

    if (operation.requestBodyType) {
      collectType(operation.requestBodyType, types);
    }

    for (const param of [...operation.pathParams, ...operation.queryParams]) {
      collectType(param.type, types);
    }
  }

  if (types.size === 0) {
    return '';
  }

  return `import { ${Array.from(types).sort().join(', ')} } from '../models';`;
}

function collectType(type: string, output: Set<string>): void {
  if (!type) {
    return;
  }

  const primitives = new Set([
    'string',
    'number',
    'boolean',
    'void',
    'unknown',
    'null',
    'Record<string, unknown>',
    // Browser built-in types — never imported from generated models.
    'Blob',
    'ArrayBuffer',
    'File',
    'FormData',
    'ReadableStream',
    'URLSearchParams',
  ]);

  if (primitives.has(type)) {
    return;
  }

  if (type.endsWith('[]')) {
    collectType(type.slice(0, -2), output);
    return;
  }

  if (type.startsWith('Record<string, ') && type.endsWith('>')) {
    const inner = type.slice('Record<string, '.length, -1);
    collectType(inner, output);
    return;
  }

  if (type.includes(' | ') || type.includes(' & ')) {
    for (const part of type.split(/[ |&]+/)) {
      collectType(part.trim(), output);
    }
    return;
  }

  if (type.startsWith('"') || type.startsWith("'")) {
    return;
  }

  // Inline object type literal — no imports needed.
  if (type.startsWith('{')) {
    return;
  }

  // Tuple type — recurse into elements.
  if (type.startsWith('[') && type.endsWith(']')) {
    const inner = type.slice(1, -1);
    for (const part of inner.split(', ')) {
      collectType(part.trim(), output);
    }
    return;
  }

  output.add(type);
}
