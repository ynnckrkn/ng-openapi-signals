export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type GroupBy = 'tag' | 'path';

export interface GeneratorConfig {
  input: string;
  output: string;
  clean: boolean;
  apiBaseUrlToken: string;
  groupBy: GroupBy;
}

export type PartialGeneratorConfig = Partial<GeneratorConfig>;

export interface GenerateOptions {
  input: string;
  output: string;
}

export interface ParameterModel {
  name: string;
  location: 'path' | 'query';
  required: boolean;
  type: string;
}

export interface OperationModel {
  operationId: string;
  tag: string;
  method: HttpMethod;
  path: string;
  pathParams: ParameterModel[];
  queryParams: ParameterModel[];
  responseType: string;
  requestBodyType?: string;
}

export interface SchemaModel {
  name: string;
  properties: SchemaPropertyModel[];
}

export interface SchemaPropertyModel {
  name: string;
  type: string;
  required: boolean;
}
