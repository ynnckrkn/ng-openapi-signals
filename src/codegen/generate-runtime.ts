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
import { provideHttpClient } from '@angular/common/http';
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
    provideHttpClient(),
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
    ? `  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';\n`
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

export interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
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

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };

    const init: RequestInit = {
      method: options.method,
      signal: options.signal,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
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

  private async parseBody(
    response: Response,
    responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer',
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

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}
`;
}

function generateApiHttpClient(config: GeneratorConfig): string {
  const responseTypeHints = config.runtime?.responseTypeHints ?? true;
  const responseTypeField = responseTypeHints
    ? `  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';\n`
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

export interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
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

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };

    const context: ApiRequestContext = {
      url,
      method: options.method,
      headers,
      body: options.body
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

  private mapResponseType(
    responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer',
  ): 'json' | 'text' | 'blob' | 'arraybuffer' | undefined {
    if (!responseType) {
      return undefined;
    }
    switch (responseType) {
      case 'arrayBuffer':
        return 'arraybuffer';
      default:
        return responseType;
    }
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
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
