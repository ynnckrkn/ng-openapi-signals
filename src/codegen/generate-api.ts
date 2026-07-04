import type {HttpMethod, OperationModel, ParameterModel} from './types';
import {kebabCase, serviceNameFromTag} from './naming';
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

      operations.push({
        operationId: operation.operationId ?? fallbackOperationId(method, path),
        tag: operation.tags?.[0] ?? 'Default',
        method,
        path,
        pathParams,
        queryParams,
        responseType: extractResponseType(operation),
        ...(requestBodyType ? {requestBodyType} : {}),
      });
    }
  }

  return operations;
}

export function generateApiFiles(operations: OperationModel[]): Record<string, string> {
  const files: Record<string, string> = {};
  const grouped = groupByTag(operations);

  for (const [tag, tagOperations] of Object.entries(grouped)) {
    files[`resources/${kebabCase(tag)}.api.ts`] = generateService(
      serviceNameFromTag(tag),
      tagOperations,
    );
  }

  files['resources/index.ts'] =
    Object.keys(grouped)
      .map((tag) => `export * from './${kebabCase(tag)}.api';`)
      .join('\n') + '\n';

  return files;
}

function generateService(serviceName: string, operations: OperationModel[]): string {
  const imports = collectModelImports(operations);

  const methods = operations
    .map((operation) => {
      if (operation.method === 'get') {
        return generateResourceMethod(operation);
      }

      return generateMutationMethod(operation);
    })
    .join('\n\n');

  return `import { Injectable, inject, resource } from '@angular/core';
import { ApiFetchClient } from '../api-fetch-client';
import { MaybeSignal, readSignalOrValue } from '../signal-utils';
${imports}

@Injectable({ providedIn: 'root' })
export class ${serviceName} {
  private readonly client = inject(ApiFetchClient);

${methods}
}
`;
}

function generateResourceMethod(operation: OperationModel): string {
  const paramsType = generateParamsType(operation);
  const resourceParamsType = generateResolvedParamsType(operation);
  const paramsExpression = generateResourceParamsExpression(operation);
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);

  return `  ${operation.operationId}Resource(params: ${paramsType}) {
    return resource({
      params: (): ${resourceParamsType} => (${paramsExpression}),
      loader: ({ params, abortSignal }: { params: ${resourceParamsType}; abortSignal: AbortSignal }) =>
        this.client.request<${operation.responseType}>({
          method: '${operation.method.toUpperCase()}',
          path: ${pathExpression},
          ${queryExpression ? `query: ${queryExpression},` : ''}
          signal: abortSignal
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

function generateMutationMethod(operation: OperationModel): string {
  const paramsType = generateParamsType(operation);
  const bodyParameter = operation.requestBodyType ? `body: ${operation.requestBodyType}, ` : '';
  const pathExpression = generatePathExpression(operation);
  const queryExpression = generateQueryExpression(operation);

  return `  ${operation.operationId}(${bodyParameter}params: ${paramsType}, signal?: AbortSignal): Promise<${operation.responseType}> {
    return this.client.request<${operation.responseType}>({
      method: '${operation.method.toUpperCase()}',
      path: ${pathExpression},
      ${queryExpression ? `query: ${queryExpression},` : ''}
      ${operation.requestBodyType ? 'body,' : ''}
      signal
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
    .map((param) => `        ${param.name}: readSignalOrValue(params.${param.name} as any)`)
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

function extractResponseType(operation: any): string {
  const responses = operation.responses ?? {};
  const response =
    responses['200'] ??
    responses['201'] ??
    responses['202'] ??
    responses['204'] ??
    Object.values(responses)[0];

  const schema = (response as any)?.content?.['application/json']?.schema;

  if (!schema) {
    return 'void';
  }

  return schemaToTsType(schema);
}

function extractRequestBodyType(operation: any): string | undefined {
  const schema = operation.requestBody?.content?.['application/json']?.schema;

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

function fallbackOperationId(method: HttpMethod, path: string): string {
  return `${method}_${path}`
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
  ]);

  if (primitives.has(type)) {
    return;
  }

  if (type.endsWith('[]')) {
    collectType(type.slice(0, -2), output);
    return;
  }

  if (type.includes(' | ')) {
    for (const part of type.split(' | ')) {
      collectType(part, output);
    }
    return;
  }

  if (type.startsWith('"') || type.startsWith("'")) {
    return;
  }

  output.add(type);
}
