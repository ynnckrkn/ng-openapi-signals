import type {GeneratorConfig} from '../types';

export function generateApiFetchClient(config: GeneratorConfig): string {
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

    if (!response.ok) {
      throw await this.errorMapper(response);
    }

    if (this.onResponse) {
      // Pass a clone so the hook can inspect the body without consuming the
      // original stream (which parseBody needs to read afterwards).
      await this.onResponse(response.clone());
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
      // For application/x-www-form-urlencoded, build URLSearchParams.
      // For multipart/form-data, build FormData and let the browser set the boundary.
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

    if (options.body !== undefined && options.body !== null) {
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
          return this.parseJson(response);
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
      return this.parseJson(response);
    }

    if (contentType.startsWith('text/')) {
      return response.text();
    }

    if (contentType.length === 0) {
      return undefined;
    }

    return response.blob();
  }

  /**
   * Safely parses a JSON response body. An empty body (e.g. a 200 with
   * Content-Type: application/json but no content) returns \`undefined\`
   * instead of throwing a SyntaxError.
   */
  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) {
      return undefined;
    }
    return JSON.parse(text);
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