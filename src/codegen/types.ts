export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type GroupBy = 'tag' | 'path';

export interface GeneratorConfig {
  input: string;
  output: string;
  clean: boolean;
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

export type SchemaModelKind = 'interface' | 'enum' | 'alias';

export interface SchemaModel {
  name: string;
  kind: SchemaModelKind;
  properties: SchemaPropertyModel[];
  /** Present when `kind === 'enum'`. */
  values?: (string | number)[];
  /** Optional enum member names from `x-enumNames` / `x-enum-varnames`. */
  enumNames?: string[];
  /** Present when `kind === 'alias'` — a type alias for a primitive or composition. */
  aliasType?: string;
}

export interface SchemaPropertyModel {
  name: string;
  type: string;
  required: boolean;
}
