export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type GroupBy = 'tag' | 'path';

/**
 * The HTTP transport used by the generated runtime.
 *
 * - `'fetch'` (default): native `fetch()`, zero `HttpClient` dependency.
 * - `'httpClient'`: Angular `HttpClient` wrapper, integrates with the
 *   Angular interceptor ecosystem and `provideHttpClient()`.
 */
export type HttpTransport = 'fetch' | 'httpClient';

/**
 * Runtime-related generator options.
 *
 * These influence the generated runtime files (providers, fetch client).
 * Runtime extension points that are functions (middleware, auth, hooks,
 * error mapper) are configured at runtime via Angular DI tokens emitted by
 * `provideNgOpenapiSignals`. Only static, codegen-time defaults live here.
 */
export interface RuntimeConfig {
  /**
   * Selects the HTTP transport for the generated runtime.
   *
   * - `'fetch'` (default): generates `ApiFetchClient` using native `fetch()`.
   * - `'httpClient'`: generates `ApiHttpClient` wrapping Angular `HttpClient`.
   *
   * The `fetch` transport preserves the zero-`HttpClient` guarantee.
   */
  transport?: HttpTransport;
  /**
   * Static default headers merged into every request. These are baked into
   * the generated `provideNgOpenapiSignals` default and can be overridden
   * per request via `ApiRequestOptions.headers`.
   */
  defaultHeaders?: Record<string, string>;
  /**
   * When `true` (default), generated API methods emit a `responseType`
   * hint (`'json' | 'text' | 'blob' | 'arrayBuffer'`) derived from the
   * OpenAPI response `content` type. Set to `false` to rely solely on
   * runtime content-type sniffing.
   */
  responseTypeHints?: boolean;
}

export interface GeneratorConfig {
  input: string;
  output: string;
  clean: boolean;
  groupBy: GroupBy;
  /** Runtime options. Omitted in partial configs; defaulted by `resolveConfig`. */
  runtime?: RuntimeConfig;
}

export type PartialGeneratorConfig = Partial<Omit<GeneratorConfig, 'runtime'>> & {
  runtime?: Partial<RuntimeConfig>;
};

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
  /** Parser hint derived from the success response content type. */
  responseParser?: 'json' | 'text' | 'blob' | 'arrayBuffer';
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
