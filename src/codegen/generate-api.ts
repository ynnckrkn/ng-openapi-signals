import type {
  GeneratorConfig,
  HttpMethod,
  MultipartPartModel,
  OperationModel,
  ParameterModel,
  QueryStyle,
  RequestBodyModel,
} from './types';
import {camelCase, kebabCase, pascalCase, serviceNameFromTag} from './naming';
import {schemaToTsType} from './schema-to-ts';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

/** Default query style per OpenAPI spec: `form` for query/header params. */
const DEFAULT_QUERY_STYLE: QueryStyle = 'form';
/** Default explode per OpenAPI spec: `true` for `form` style query params. */
const DEFAULT_QUERY_EXPLODE = true;

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

      const headerParams = parameters
        .filter((parameter: any) => parameter.in === 'header')
        .map(toParameterModel);

      const requestBody = extractRequestBody(operation);
      const {responseType, responseParser} = extractResponseType(operation);

      operations.push({
        operationId: operation.operationId ?? fallbackOperationId(method, path),
        tag: operation.tags?.[0] ?? 'Default',
        method,
        path,
        pathParams,
        queryParams,
        headerParams,
        responseType,
        ...(responseParser ? {responseParser} : {}),
        ...(requestBody ? {requestBody, requestBodyType: requestBody.type} : {}),
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
  const grouped = config.groupBy === 'path' ? groupByPath(operations) : groupByTag(operations);

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
    (op) =>
      op.method === 'get' &&
      op.pathParams.length + op.queryParams.length + op.headerParams.length > 0,
  );
  const hasMutationsWithParams = operations.some(
    (op) =>
      op.method !== 'get' &&
      op.pathParams.length + op.queryParams.length + op.headerParams.length > 0,
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
    hasGetsWithParams || hasMutationsWithParams
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
  const hasParams =
    operation.pathParams.length + operation.queryParams.length + operation.headerParams.length > 0;
  const paramsType = generateParamsType(operation);
  const resourceParamsType = generateResolvedParamsType(operation);
  const paramsExpression = generateResourceParamsExpression(operation);
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);
  const headerExpression = generateHeaderExpression(operation);
  const paramsArg = hasParams ? `params: ${paramsType}` : '';
  const paramsFactory = hasParams
    ? `params: (): ${resourceParamsType} => (${paramsExpression}),`
    : '';

  const requestLines = [`method: '${operation.method.toUpperCase()}',`, `path: ${pathExpression},`];

  if (queryExpression) {
    requestLines.push(`query: ${queryExpression},`);
  }

  if (headerExpression) {
    requestLines.push(`headers: ${headerExpression},`);
  }

  if (responseTypeHints && operation.responseParser) {
    requestLines.push(`responseType: '${operation.responseParser}',`);
  }

  requestLines.push('signal: abortSignal');
  const requestBody = requestLines.map((line) => `          ${line}`).join('\n');

  const loaderSignature = hasParams
    ? `loader: ({ params, abortSignal }: { params: ${resourceParamsType}; abortSignal: AbortSignal }) =>`
    : `loader: ({ abortSignal }: { abortSignal: AbortSignal }) =>`;

  return `  ${operation.operationId}Resource(${paramsArg}) {
    return resource({
      ${paramsFactory}
      ${loaderSignature}
        this.client.request<${operation.responseType}>({
${requestBody}
        })
    });
  }`;
}

function generateResolvedParamsType(operation: OperationModel): string {
  const params = [...operation.pathParams, ...operation.queryParams, ...operation.headerParams];

  if (params.length === 0) {
    return 'undefined';
  }

  const properties = params
    .map((param) => {
      const optional = param.required ? '' : '?';
      const name = formatParamName(param);
      return `    ${name}${optional}: ${param.type};`;
    })
    .join('\n');

  return `{
${properties}
  }`;
}

function generateMutationMethod(operation: OperationModel, responseTypeHints: boolean): string {
  const hasParams =
    operation.pathParams.length + operation.queryParams.length + operation.headerParams.length > 0;
  const paramsType = generateParamsType(operation);
  const bodyType = operation.requestBody?.type ?? operation.requestBodyType;
  const bodyParameter = bodyType ? `body: ${bodyType}, ` : '';
  const paramsParameter = hasParams ? `params: ${paramsType}, ` : '';
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);
  const headerExpression = generateHeaderExpression(operation);

  const requestLines = [`method: '${operation.method.toUpperCase()}',`, `path: ${pathExpression},`];

  if (queryExpression) {
    requestLines.push(`query: ${queryExpression},`);
  }

  if (headerExpression) {
    requestLines.push(`headers: ${headerExpression},`);
  }

  if (bodyType) {
    if (operation.requestBody?.isMultipart) {
      // Multipart: pass body as formData; runtime builds FormData.
      requestLines.push('formData: body,');
    } else if (operation.requestBody?.isFormUrlencoded) {
      // Form URL-encoded: pass body as formData; runtime builds URLSearchParams.
      requestLines.push('formData: body,');
    } else {
      requestLines.push('body,');
    }
  }

  // Emit contentType for non-JSON request bodies.
  if (operation.requestBody && operation.requestBody.contentType !== 'application/json') {
    requestLines.push(`contentType: ${JSON.stringify(operation.requestBody.contentType)},`);
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
  const params = [...operation.pathParams, ...operation.queryParams, ...operation.headerParams];

  if (params.length === 0) {
    return 'void';
  }

  const properties = params
    .map((param) => {
      const optional = param.required ? '' : '?';
      const name = formatParamName(param);
      return `    ${name}${optional}: MaybeSignal<${param.type}>;`;
    })
    .join('\n');

  return `{
${properties}
  }`;
}

function generateResourceParamsExpression(operation: OperationModel): string {
  const params = [...operation.pathParams, ...operation.queryParams, ...operation.headerParams];

  if (params.length === 0) {
    return 'undefined';
  }

  const properties = params
    .map(
      (param) =>
        `        ${formatParamName(param)}: readSignalOrValue(${formatParamAccess(param)})`,
    )
    .join(',\n');

  return `{
${properties}
      }`;
}

function generatePathExpression(operation: OperationModel): string {
  const hasParams =
    [...operation.pathParams, ...operation.queryParams, ...operation.headerParams].length > 0;

  if (!hasParams) {
    return `'${operation.path}'`;
  }

  const templatePath = operation.path.replace(
    /{([^}]+)}/g,
    (_, name) => `\${encodeURIComponent(String(params.${name}))}`,
  );

  return '`' + templatePath + '`';
}

/**
 * Formats a parameter name for use as a TypeScript property name.
 *
 * Header parameters may contain hyphens (e.g. `X-Request-Id`), which are
 * not valid in unquoted TypeScript identifiers. Such names are quoted.
 */
function formatParamName(param: ParameterModel): string {
  if (param.location === 'header' && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(param.name)) {
    return `'${param.name}'`;
  }
  return param.name;
}

/**
 * Formats a parameter name for use in a template literal expression
 * (e.g. `params.${name}`). Header names with hyphens need bracket notation.
 */
function formatParamAccess(param: ParameterModel): string {
  if (param.location === 'header' && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(param.name)) {
    return `params['${param.name}']`;
  }
  return `params.${param.name}`;
}

/**
 * Generates the query expression for the runtime client.
 *
 * For parameters with non-default style/explode, wraps the value with metadata:
 * `{ value: params.tags, style: 'spaceDelimited', explode: false }`.
 * For default style (form + explode:true), passes the plain value for
 * backward compatibility.
 */
function generateQueryExpression(operation: OperationModel): string {
  if (operation.queryParams.length === 0) {
    return '';
  }

  const properties = operation.queryParams
    .map((param) => {
      const isDefaultStyle =
        (!param.style || param.style === DEFAULT_QUERY_STYLE) &&
        (param.explode === undefined || param.explode === DEFAULT_QUERY_EXPLODE);

      if (isDefaultStyle) {
        return `            ${param.name}: ${formatParamAccess(param)}`;
      }

      const style = param.style ?? DEFAULT_QUERY_STYLE;
      const explode = param.explode ?? DEFAULT_QUERY_EXPLODE;
      return `            ${param.name}: { value: ${formatParamAccess(param)}, style: '${style}', explode: ${explode} }`;
    })
    .join(',\n');

  return `{
${properties}
          }`;
}

/**
 * Generates a headers object expression for header parameters.
 * Returns empty string if there are no header parameters.
 */
function generateHeaderExpression(operation: OperationModel): string {
  if (operation.headerParams.length === 0) {
    return '';
  }

  const properties = operation.headerParams
    .map((param) => `            '${param.name}': ${formatParamAccess(param)}`)
    .join(',\n');

  return `{
${properties}
          }`;
}

function toParameterModel(parameter: any): ParameterModel {
  const style = parameter.style as QueryStyle | undefined;
  const explode = parameter.explode as boolean | undefined;

  return {
    name: parameter.name,
    location: parameter.in,
    required: Boolean(parameter.required),
    type: schemaToTsType(parameter.schema),
    // Only emit style/explode for query params with non-default values.
    ...(style && style !== DEFAULT_QUERY_STYLE ? {style} : {}),
    ...(explode !== undefined && explode !== DEFAULT_QUERY_EXPLODE ? {explode} : {}),
  };
}

function extractResponseType(operation: any): {
  responseType: string;
  responseParser?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';
} {
  const responses = operation.responses ?? {};

  // Collect all 2xx response schemas (including 2XX range from OpenAPI 3.1).
  const successSchemas: string[] = [];
  let responseParser: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream' | undefined;

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
): 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream' | undefined {
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return 'json';
  }

  if (contentType === 'text/event-stream') {
    return 'stream';
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

/**
 * Extracts the request body model from an OpenAPI operation.
 *
 * Selects the primary content type with preference for `application/json`.
 * Detects `multipart/form-data` and `application/x-www-form-urlencoded` and
 * captures part schemas for multipart bodies.
 */
function extractRequestBody(operation: any): RequestBodyModel | undefined {
  const content = operation.requestBody?.content;
  if (!content) {
    return undefined;
  }

  const entries = Object.entries(content) as [string, any][];
  if (entries.length === 0) {
    return undefined;
  }

  // Select the primary content type: prefer application/json, then the
  // first entry with a schema.
  const jsonEntry = entries.find(([type]) => type === 'application/json');
  const firstWithSchema = entries.find(([, c]) => c?.schema);
  const chosen = jsonEntry ?? firstWithSchema;

  if (!chosen) {
    return undefined;
  }

  const [contentType, contentObj] = chosen;
  const schema = contentObj?.schema;

  if (!schema) {
    return undefined;
  }

  const isMultipart = contentType === 'multipart/form-data';
  const isFormUrlencoded = contentType === 'application/x-www-form-urlencoded';

  let parts: MultipartPartModel[] | undefined;

  if (isMultipart && schema.type === 'object' && schema.properties) {
    const required = new Set<string>(schema.required ?? []);
    parts = Object.entries(schema.properties).map(([name, propSchema]: [string, any]) => ({
      name,
      type: schemaToTsType(propSchema),
      required: required.has(name),
    }));
  }

  return {
    type: schemaToTsType(schema),
    contentType,
    isMultipart,
    isFormUrlencoded,
    ...(parts ? {parts} : {}),
  };
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

    const bodyType = operation.requestBody?.type ?? operation.requestBodyType;
    if (bodyType) {
      collectType(bodyType, types);
    }

    for (const param of [
      ...operation.pathParams,
      ...operation.queryParams,
      ...operation.headerParams,
    ]) {
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
