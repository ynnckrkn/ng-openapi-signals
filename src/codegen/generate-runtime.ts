import type {GeneratorConfig} from './types';

export function generateRuntimeFiles(_config: GeneratorConfig): Record<string, string> {
  return {
    'providers.ts': generateProviders(),
    'api-error.ts': generateApiError(),
    'api-fetch-client.ts': generateApiFetchClient(),
    'signal-utils.ts': generateSignalUtils(),
  };
}

function generateProviders(): string {
  return `import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

export const NG_OPENAPI_SIGNALS_BASE_PATH = new InjectionToken<string>('NG_OPENAPI_SIGNALS_BASE_PATH');

export interface NgOpenapiSignalsOptions {
  basePath: string;
}

export function provideNgOpenapiSignals(options: NgOpenapiSignalsOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: NG_OPENAPI_SIGNALS_BASE_PATH,
      useValue: options.basePath
    }
  ]);
}
`;
}

function generateApiError(): string {
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

function generateApiFetchClient(): string {
  return `import { Service, inject } from '@angular/core';
import { NG_OPENAPI_SIGNALS_BASE_PATH } from './providers';
import { toApiError } from './api-error';

export interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

@Service()
export class ApiFetchClient {
  private readonly baseUrl = inject(NG_OPENAPI_SIGNALS_BASE_PATH);

  async request<T>(options: ApiRequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);

    const response = await fetch(url, {
      method: options.method,
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('application/json')) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
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
