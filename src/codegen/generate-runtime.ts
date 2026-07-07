import type {GeneratorConfig} from './types';

export function generateRuntimeFiles(config: GeneratorConfig): Record<string, string> {
  const transport = config.runtime?.transport ?? 'fetch';

  if (transport === 'httpClient') {
    return {
      'providers.ts': generateProviders(config),
      'api-error.ts': generateApiError(config),
      'api-http-client.ts': generateApiHttpClient(config),
      'signal-utils.ts': generateSignalUtils(),
    };
  }

  return {
    'providers.ts': generateProviders(config),
    'api-error.ts': generateApiError(config),
    'api-fetch-client.ts': generateApiFetchClient(config),
    'signal-utils.ts': generateSignalUtils(),
  };
}

function generateProviders(config: GeneratorConfig): string {
  const transport = config.runtime?.transport ?? 'fetch';
  return transport === 'httpClient'
    ? generateProvidersHttpClient(config)
    : generateProvidersFetch(config);
}

function generateProvidersFetch(config: GeneratorConfig): string {
  const defaultHeaders = config.runtime?.defaultHeaders ?? {};
  const defaultHeadersLiteral = objectLiteral(defaultHeaders);

  return `import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { toApiError, ApiError } from './api-error';

export const NG_OPENAPI_SIGNALS_BASE_PATH = new InjectionToken<string>('NG_OPENAPI_SIGNALS_BASE_PATH');

export const NG_OPENAPI_SIGNALS_MIDDLEWARE = new InjectionToken<ReadonlyArray<ApiMiddleware>>(
  'NG_OPENAPI_SIGNALS_MIDDLEWARE',
);

export const NG_OPENAPI_SIGNALS_AUTH = new InjectionToken<ApiAuthHook | undefined>(
  'NG_OPENAPI_SIGNALS_AUTH',
);

export const NG_OPENAPI_SIGNALS_DEFAULT_HEADERS = new InjectionToken<Record<string, string>>(
  'NG_OPENAPI_SIGNALS_DEFAULT_HEADERS',
);

export const NG_OPENAPI_SIGNALS_ERROR_MAPPER = new InjectionToken<ApiErrorMapper>(
  'NG_OPENAPI_SIGNALS_ERROR_MAPPER',
);

export const NG_OPENAPI_SIGNALS_REQUEST_HOOK = new InjectionToken<
  ApiRequestHook | undefined
>('NG_OPENAPI_SIGNALS_REQUEST_HOOK');

export const NG_OPENAPI_SIGNALS_RESPONSE_HOOK = new InjectionToken<
  ApiResponseHook | undefined
>('NG_OPENAPI_SIGNALS_RESPONSE_HOOK');

/**
 * A fetch middleware function in onion-style: receives the request context
 * and a \`next\` function that calls the next middleware (or the core fetch).
 * Can mutate the request, short-circuit, transform the response, or handle errors.
 */
export type ApiMiddleware = (
  request: ApiRequestContext,
  next: () => Promise<Response>,
) => Promise<Response>;

/**
 * Hook that returns additional headers to merge into every request.
 * Called once per request. Useful for auth tokens that may rotate.
 */
export type ApiAuthHook = () => Record<string, string> | Promise<Record<string, string>>;

/**
 * Maps a non-OK \`Response\` to an error. Defaults to \`toApiError\`.
 */
export type ApiErrorMapper = (response: Response) => Promise<ApiError | Error> | ApiError | Error;

/**
 * Called before the middleware pipeline runs. Can mutate the request context
 * (e.g. add headers, change the URL). Return value is ignored.
 */
export type ApiRequestHook = (request: ApiRequestContext) => void | Promise<void>;

/**
 * Called after a successful response is received. Receives the raw Response.
 * Return value is ignored.
 */
export type ApiResponseHook = (response: Response) => void | Promise<void>;

export interface ApiRequestContext {
  url: string;
  init: RequestInit;
}

export interface NgOpenapiSignalsOptions {
  basePath: string;
  middleware?: ReadonlyArray<ApiMiddleware>;
  auth?: ApiAuthHook;
  defaultHeaders?: Record<string, string>;
  errorMapper?: ApiErrorMapper;
  onRequest?: ApiRequestHook;
  onResponse?: ApiResponseHook;
}

export function provideNgOpenapiSignals(
  options: NgOpenapiSignalsOptions,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: NG_OPENAPI_SIGNALS_BASE_PATH,
      useValue: options.basePath,
    },
    {
      provide: NG_OPENAPI_SIGNALS_MIDDLEWARE,
      useValue: options.middleware ?? [],
    },
    {
      provide: NG_OPENAPI_SIGNALS_AUTH,
      useValue: options.auth,
    },
    {
      provide: NG_OPENAPI_SIGNALS_DEFAULT_HEADERS,
      useValue: { ...${defaultHeadersLiteral}, ...options.defaultHeaders },
    },
    {
      provide: NG_OPENAPI_SIGNALS_ERROR_MAPPER,
      useValue: options.errorMapper ?? toApiError,
    },
    {
      provide: NG_OPENAPI_SIGNALS_REQUEST_HOOK,
      useValue: options.onRequest,
    },
    {
      provide: NG_OPENAPI_SIGNALS_RESPONSE_HOOK,
      useValue: options.onResponse,
    },
  ]);
}
`;
}

function generateProvidersHttpClient(config: GeneratorConfig): string {
  const defaultHeaders = config.runtime?.defaultHeaders ?? {};
  const defaultHeadersLiteral = objectLiteral(defaultHeaders);

  return `import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { toApiErrorFromHttpErrorResponse, ApiError } from './api-error';

export const NG_OPENAPI_SIGNALS_BASE_PATH = new InjectionToken<string>('NG_OPENAPI_SIGNALS_BASE_PATH');

export const NG_OPENAPI_SIGNALS_AUTH = new InjectionToken<ApiAuthHook | undefined>(
  'NG_OPENAPI_SIGNALS_AUTH',
);

export const NG_OPENAPI_SIGNALS_DEFAULT_HEADERS = new InjectionToken<Record<string, string>>(
  'NG_OPENAPI_SIGNALS_DEFAULT_HEADERS',
);

export const NG_OPENAPI_SIGNALS_ERROR_MAPPER = new InjectionToken<ApiErrorMapper>(
  'NG_OPENAPI_SIGNALS_ERROR_MAPPER',
);

export const NG_OPENAPI_SIGNALS_REQUEST_HOOK = new InjectionToken<
  ApiRequestHook | undefined
>('NG_OPENAPI_SIGNALS_REQUEST_HOOK');

export const NG_OPENAPI_SIGNALS_RESPONSE_HOOK = new InjectionToken<
  ApiResponseHook | undefined
>('NG_OPENAPI_SIGNALS_RESPONSE_HOOK');

/**
 * Hook that returns additional headers to merge into every request.
 * Called once per request. Useful for auth tokens that may rotate.
 */
export type ApiAuthHook = () => Record<string, string> | Promise<Record<string, string>>;

/**
 * Maps a non-OK \`HttpErrorResponse\` to an error. Defaults to \`toApiErrorFromHttpErrorResponse\`.
 */
export type ApiErrorMapper = (
  response: HttpErrorResponse,
) => Promise<ApiError | Error> | ApiError | Error;

/**
 * Called before the request is sent. Can mutate the request context
 * (e.g. add headers, change the URL). Return value is ignored.
 */
export type ApiRequestHook = (request: ApiRequestContext) => void | Promise<void>;

/**
 * Called after a successful response is received. Receives the raw \`HttpResponse\`.
 * Return value is ignored.
 */
export type ApiResponseHook = (response: HttpResponse<unknown>) => void | Promise<void>;

export interface ApiRequestContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface NgOpenapiSignalsOptions {
  basePath: string;
  auth?: ApiAuthHook;
  defaultHeaders?: Record<string, string>;
  errorMapper?: ApiErrorMapper;
  onRequest?: ApiRequestHook;
  onResponse?: ApiResponseHook;
}

export function provideNgOpenapiSignals(
  options: NgOpenapiSignalsOptions,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: NG_OPENAPI_SIGNALS_BASE_PATH,
      useValue: options.basePath,
    },
    {
      provide: NG_OPENAPI_SIGNALS_AUTH,
      useValue: options.auth,
    },
    {
      provide: NG_OPENAPI_SIGNALS_DEFAULT_HEADERS,
      useValue: { ...${defaultHeadersLiteral}, ...options.defaultHeaders },
    },
    {
      provide: NG_OPENAPI_SIGNALS_ERROR_MAPPER,
      useValue: options.errorMapper ?? toApiErrorFromHttpErrorResponse,
    },
    {
      provide: NG_OPENAPI_SIGNALS_REQUEST_HOOK,
      useValue: options.onRequest,
    },
    {
      provide: NG_OPENAPI_SIGNALS_RESPONSE_HOOK,
      useValue: options.onResponse,
    },
  ]);
}
`;
}

function generateApiError(config: GeneratorConfig): string {
  const transport = config.runtime?.transport ?? 'fetch';

  if (transport === 'httpClient') {
    return `import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

export interface ApiError {
  status: number;
  statusText: string;
  body: unknown;
  headers: HttpHeaders;
}

export function toApiErrorFromHttpErrorResponse(error: HttpErrorResponse): ApiError {
  return {
    status: error.status,
    statusText: error.statusText,
    body: error.error,
    headers: error.headers
  };
}
`;
  }

  return `export interface ApiError {
  status: number;
  statusText: string;
  body: unknown;
  headers: Headers;
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;

  try {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch {
    body = null;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    body,
    headers: response.headers
  };
}
`;
}

function generateApiFetchClient(config: GeneratorConfig): string {
  const responseTypeHints = config.runtime?.responseTypeHints ?? true;
  const responseTypeField = responseTypeHints
    ? `  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';\n`
    : '';

  return `import { Service, inject } from '@angular/core';
import {
  NG_OPENAPI_SIGNALS_BASE_PATH,
  NG_OPENAPI_SIGNALS_MIDDLEWARE,
  NG_OPENAPI_SIGNALS_AUTH,
  NG_OPENAPI_SIGNALS_DEFAULT_HEADERS,
  NG_OPENAPI_SIGNALS_ERROR_MAPPER,
  NG_OPENAPI_SIGNALS_REQUEST_HOOK,
  NG_OPENAPI_SIGNALS_RESPONSE_HOOK,
  type ApiRequestContext,
} from './providers';

/**
 * Query parameter serialization metadata for non-default styles.
 *
 * When a query parameter uses a non-default OpenAPI style/explode, the
 * generated code wraps the value with this metadata so the runtime can
 * serialize it correctly.
 */
export interface QueryParamOptions {
  value: unknown;
  style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode: boolean;
}

export interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown | QueryParamOptions>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
  /**
   * Form data object for multipart/form-data or application/x-www-form-urlencoded.
   * The runtime converts this to FormData or URLSearchParams respectively.
   * When set, takes precedence over \`body\`.
   */
  formData?: object;
  /**
   * Explicit Content-Type for the request body. When omitted, the runtime
   * defaults to 'application/json' for JSON bodies. For FormData, the
   * Content-Type is set automatically by the browser (multipart boundary).
   */
  contentType?: string;
  signal?: AbortSignal;
${responseTypeField}}

@Service()
export class ApiFetchClient {
  private readonly baseUrl = inject(NG_OPENAPI_SIGNALS_BASE_PATH);
  private readonly middleware = inject(NG_OPENAPI_SIGNALS_MIDDLEWARE);
  private readonly auth = inject(NG_OPENAPI_SIGNALS_AUTH, { optional: true });
  private readonly defaultHeaders = inject(NG_OPENAPI_SIGNALS_DEFAULT_HEADERS);
  private readonly errorMapper = inject(NG_OPENAPI_SIGNALS_ERROR_MAPPER);
  private readonly onRequest = inject(NG_OPENAPI_SIGNALS_REQUEST_HOOK, { optional: true });
  private readonly onResponse = inject(NG_OPENAPI_SIGNALS_RESPONSE_HOOK, { optional: true });

  async request<T>(options: ApiRequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);

    const authHeaders = this.auth ? await this.auth() : {};

    // Build the request body and determine Content-Type.
    const { body, contentType } = this.prepareBody(options);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...this.stripUndefinedHeaders(options.headers)
    };

    const init: RequestInit = {
      method: options.method,
      signal: options.signal,
      headers,
      ...(body !== undefined ? { body } : {})
    };

    const context: ApiRequestContext = { url, init };

    if (this.onRequest) {
      await this.onRequest(context);
    }

    const coreFetch = async (): Promise<Response> => fetch(context.url, context.init);

    const pipeline = this.middleware.reduceRight<() => Promise<Response>>(
      (next, mw) => async () => mw(context, next),
      coreFetch,
    );

    const response = await pipeline();

    if (this.onResponse) {
      await this.onResponse(response);
    }

    if (!response.ok) {
      throw await this.errorMapper(response);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await this.parseBody(response, options.responseType)) as T;
  }

  /**
   * Removes headers with \`undefined\` values so they are not sent.
   * Optional header parameters may resolve to \`undefined\` when omitted.
   */
  private stripUndefinedHeaders(
    headers: Record<string, string | undefined> | undefined,
  ): Record<string, string> {
    if (!headers) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Prepares the request body and determines the Content-Type.
   *
   * - FormData objects: builds FormData from the object, lets the browser
   *   set the multipart boundary (no explicit Content-Type).
   * - URLSearchParams: builds from the object for form-urlencoded.
   * - Blob/ArrayBuffer: passes through with the provided contentType.
   * - Plain objects: JSON.stringify with 'application/json'.
   */
  private prepareBody(options: ApiRequestOptions): { body: BodyInit | undefined; contentType?: string } {
    // FormData takes precedence over body.
    if (options.formData !== undefined) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(options.formData)) {
        if (value === undefined || value === null) {
          continue;
        }
        if (value instanceof Blob) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
      // For multipart/form-data, let the browser set the boundary.
      // For application/x-www-form-urlencoded, use URLSearchParams.
      if (options.contentType === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.formData)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        return { body: params.toString(), contentType: 'application/x-www-form-urlencoded' };
      }
      return { body: formData };
    }

    if (options.body !== undefined) {
      // Pass through FormData, Blob, ArrayBuffer, URLSearchParams, ReadableStream.
      if (
        options.body instanceof FormData ||
        options.body instanceof Blob ||
        options.body instanceof ArrayBuffer ||
        options.body instanceof URLSearchParams ||
        (typeof ReadableStream !== 'undefined' && options.body instanceof ReadableStream)
      ) {
        return { body: options.body as BodyInit, contentType: options.contentType };
      }
      // Default: JSON.stringify.
      return { body: JSON.stringify(options.body), contentType: options.contentType ?? 'application/json' };
    }

    return { body: undefined };
  }

  private async parseBody(
    response: Response,
    responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream',
  ): Promise<unknown> {
    if (responseType) {
      switch (responseType) {
        case 'json':
          return response.json();
        case 'text':
          return response.text();
        case 'blob':
          return response.blob();
        case 'arrayBuffer':
          return response.arrayBuffer();
        case 'stream':
          return response.body;
      }
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    if (contentType.startsWith('text/')) {
      return response.text();
    }

    if (contentType.length === 0) {
      return undefined;
    }

    return response.blob();
  }

  private buildUrl(path: string, query?: Record<string, unknown | QueryParamOptions>): string {
    const url = new URL(path, this.baseUrl);

    for (const [key, raw] of Object.entries(query ?? {})) {
      if (raw === undefined || raw === null) {
        continue;
      }

      // Check if the value is wrapped with serialization metadata.
      const isWrapped =
        typeof raw === 'object' &&
        raw !== null &&
        !Array.isArray(raw) &&
        'value' in raw &&
        'style' in raw;

      if (isWrapped) {
        const opts = raw as QueryParamOptions;
        if (opts.value === undefined || opts.value === null) {
          continue;
        }
        this.appendQueryParam(url, key, opts.value, opts.style, opts.explode);
      } else {
        this.appendQueryParam(url, key, raw, 'form', true);
      }
    }

    return url.toString();
  }

  /**
   * Appends a query parameter using the specified OpenAPI style/explode.
   *
   * - form + explode:true  → key=val1&key=val2 (repeated keys)
   * - form + explode:false → key=val1,val2 (comma-separated)
   * - spaceDelimited + explode:false → key=val1%20val2
   * - spaceDelimited + explode:true  → key=val1&key=val2
   * - pipeDelimited + explode:false  → key=val1|val2
   * - pipeDelimited + explode:true   → key=val1&key=val2
   * - deepObject (explode:true only)  → key[prop]=val
   */
  private appendQueryParam(
    url: URL,
    key: string,
    value: unknown,
    style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject',
    explode: boolean,
  ): void {
    if (Array.isArray(value)) {
      if (explode) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        const sep = style === 'spaceDelimited' ? ' ' : style === 'pipeDelimited' ? '|' : ',';
        url.searchParams.set(key, value.map((v) => String(v)).join(sep));
      }
    } else if (typeof value === 'object' && value !== null && style === 'deepObject' && explode) {
      for (const [prop, val] of Object.entries(value)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(\`\${key}[\${prop}]\`, String(val));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}
`;
}

function generateApiHttpClient(config: GeneratorConfig): string {
  const responseTypeHints = config.runtime?.responseTypeHints ?? true;
  const responseTypeField = responseTypeHints
    ? `  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';\n`
    : '';

  return `import { Service, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  NG_OPENAPI_SIGNALS_BASE_PATH,
  NG_OPENAPI_SIGNALS_AUTH,
  NG_OPENAPI_SIGNALS_DEFAULT_HEADERS,
  NG_OPENAPI_SIGNALS_ERROR_MAPPER,
  NG_OPENAPI_SIGNALS_REQUEST_HOOK,
  NG_OPENAPI_SIGNALS_RESPONSE_HOOK,
  type ApiRequestContext,
} from './providers';

/**
 * Query parameter serialization metadata for non-default styles.
 *
 * When a query parameter uses a non-default OpenAPI style/explode, the
 * generated code wraps the value with this metadata so the runtime can
 * serialize it correctly.
 */
export interface QueryParamOptions {
  value: unknown;
  style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode: boolean;
}

export interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown | QueryParamOptions>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
  /**
   * Form data object for multipart/form-data or application/x-www-form-urlencoded.
   * The runtime converts this to FormData or URLSearchParams respectively.
   * When set, takes precedence over \`body\`.
   */
  formData?: object;
  /**
   * Explicit Content-Type for the request body. When omitted, the runtime
   * defaults to 'application/json' for JSON bodies. For FormData, the
   * Content-Type is set automatically by the browser (multipart boundary).
   */
  contentType?: string;
  signal?: AbortSignal;
${responseTypeField}}

@Service()
export class ApiHttpClient {
  private readonly baseUrl = inject(NG_OPENAPI_SIGNALS_BASE_PATH);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(NG_OPENAPI_SIGNALS_AUTH, { optional: true });
  private readonly defaultHeaders = inject(NG_OPENAPI_SIGNALS_DEFAULT_HEADERS);
  private readonly errorMapper = inject(NG_OPENAPI_SIGNALS_ERROR_MAPPER);
  private readonly onRequest = inject(NG_OPENAPI_SIGNALS_REQUEST_HOOK, { optional: true });
  private readonly onResponse = inject(NG_OPENAPI_SIGNALS_RESPONSE_HOOK, { optional: true });

  async request<T>(options: ApiRequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);

    const authHeaders = this.auth ? await this.auth() : {};

    // Build the request body and determine Content-Type.
    const { body, contentType } = this.prepareBody(options);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...this.stripUndefinedHeaders(options.headers)
    };

    const context: ApiRequestContext = {
      url,
      method: options.method,
      headers,
      body
    };

    if (this.onRequest) {
      await this.onRequest(context);
    }

    const responseType = this.mapResponseType(options.responseType);

    try {
      let response: HttpResponse<unknown>;

      if (responseType === 'arraybuffer') {
        response = await firstValueFrom(
          this.http.request(context.method, context.url, {
            headers: context.headers,
            ...(context.body !== undefined ? { body: context.body } : {}),
            observe: 'response',
            responseType: 'arraybuffer',
            ...(options.signal ? { signal: options.signal } : {}),
          }),
        );
      } else if (responseType === 'blob') {
        response = await firstValueFrom(
          this.http.request(context.method, context.url, {
            headers: context.headers,
            ...(context.body !== undefined ? { body: context.body } : {}),
            observe: 'response',
            responseType: 'blob',
            ...(options.signal ? { signal: options.signal } : {}),
          }),
        );
      } else if (responseType === 'text') {
        response = await firstValueFrom(
          this.http.request(context.method, context.url, {
            headers: context.headers,
            ...(context.body !== undefined ? { body: context.body } : {}),
            observe: 'response',
            responseType: 'text',
            ...(options.signal ? { signal: options.signal } : {}),
          }),
        );
      } else {
        response = await firstValueFrom(
          this.http.request<unknown>(context.method, context.url, {
            headers: context.headers,
            ...(context.body !== undefined ? { body: context.body } : {}),
            observe: 'response',
            responseType: 'json',
            ...(options.signal ? { signal: options.signal } : {}),
          }),
        );
      }

      if (this.onResponse) {
        await this.onResponse(response);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return response.body as T;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        throw await this.errorMapper(error);
      }
      throw error;
    }
  }

  /**
   * Removes headers with \`undefined\` values so they are not sent.
   * Optional header parameters may resolve to \`undefined\` when omitted.
   */
  private stripUndefinedHeaders(
    headers: Record<string, string | undefined> | undefined,
  ): Record<string, string> {
    if (!headers) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Prepares the request body and determines the Content-Type.
   *
   * - FormData objects: builds FormData from the object, lets the browser
   *   set the multipart boundary (no explicit Content-Type).
   * - URLSearchParams: builds from the object for form-urlencoded.
   * - Blob/ArrayBuffer: passes through with the provided contentType.
   * - Plain objects: passed directly; HttpClient serializes as JSON.
   */
  private prepareBody(options: ApiRequestOptions): { body: unknown; contentType?: string } {
    // FormData takes precedence over body.
    if (options.formData !== undefined) {
      if (options.contentType === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.formData)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        return { body: params.toString(), contentType: 'application/x-www-form-urlencoded' };
      }
      const formData = new FormData();
      for (const [key, value] of Object.entries(options.formData)) {
        if (value === undefined || value === null) {
          continue;
        }
        if (value instanceof Blob) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
      return { body: formData };
    }

    if (options.body !== undefined) {
      // Pass through FormData, Blob, ArrayBuffer, URLSearchParams.
      if (
        options.body instanceof FormData ||
        options.body instanceof Blob ||
        options.body instanceof ArrayBuffer ||
        options.body instanceof URLSearchParams
      ) {
        return { body: options.body, contentType: options.contentType };
      }
      // Default: let HttpClient handle JSON serialization.
      return { body: options.body, contentType: options.contentType ?? 'application/json' };
    }

    return { body: undefined };
  }

  /**
   * Maps the responseType to Angular's HttpClient responseType.
   *
   * 'stream' maps to 'blob' since Angular HttpClient has no native stream
   * support. Consumers can call .stream() on the returned Blob.
   */
  private mapResponseType(
    responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream',
  ): 'json' | 'text' | 'blob' | 'arraybuffer' | undefined {
    if (!responseType) {
      return undefined;
    }
    switch (responseType) {
      case 'arrayBuffer':
        return 'arraybuffer';
      case 'stream':
        return 'blob';
      default:
        return responseType;
    }
  }

  private buildUrl(path: string, query?: Record<string, unknown | QueryParamOptions>): string {
    const url = new URL(path, this.baseUrl);

    for (const [key, raw] of Object.entries(query ?? {})) {
      if (raw === undefined || raw === null) {
        continue;
      }

      // Check if the value is wrapped with serialization metadata.
      const isWrapped =
        typeof raw === 'object' &&
        raw !== null &&
        !Array.isArray(raw) &&
        'value' in raw &&
        'style' in raw;

      if (isWrapped) {
        const opts = raw as QueryParamOptions;
        if (opts.value === undefined || opts.value === null) {
          continue;
        }
        this.appendQueryParam(url, key, opts.value, opts.style, opts.explode);
      } else {
        this.appendQueryParam(url, key, raw, 'form', true);
      }
    }

    return url.toString();
  }

  /**
   * Appends a query parameter using the specified OpenAPI style/explode.
   *
   * - form + explode:true  → key=val1&key=val2 (repeated keys)
   * - form + explode:false → key=val1,val2 (comma-separated)
   * - spaceDelimited + explode:false → key=val1%20val2
   * - spaceDelimited + explode:true  → key=val1&key=val2
   * - pipeDelimited + explode:false  → key=val1|val2
   * - pipeDelimited + explode:true   → key=val1&key=val2
   * - deepObject (explode:true only)  → key[prop]=val
   */
  private appendQueryParam(
    url: URL,
    key: string,
    value: unknown,
    style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject',
    explode: boolean,
  ): void {
    if (Array.isArray(value)) {
      if (explode) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        const sep = style === 'spaceDelimited' ? ' ' : style === 'pipeDelimited' ? '|' : ',';
        url.searchParams.set(key, value.map((v) => String(v)).join(sep));
      }
    } else if (typeof value === 'object' && value !== null && style === 'deepObject' && explode) {
      for (const [prop, val] of Object.entries(value)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(\`\${key}[\${prop}]\`, String(val));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}
`;
}

function generateSignalUtils(): string {
  return `import { Signal, isSignal } from '@angular/core';

export type MaybeSignal<T> = T | Signal<T>;

export function readSignalOrValue<T>(value: MaybeSignal<T>): T {
  return isSignal(value) ? value() : value;
}
`;
}

/** Renders a plain object as a TypeScript literal (no nested objects). */
function objectLiteral(value: Record<string, string>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }
  return (
    '{ ' +
    entries.map(([key, val]) => `${JSON.stringify(key)}: ${JSON.stringify(val)}`).join(', ') +
    ' }'
  );
}
