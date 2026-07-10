import {describe, it, expect, vi, afterEach} from 'vitest';

// Tests mirror the generated api-fetch-client.ts template logic without Angular DI.
// Dependencies that would be injected are passed explicitly to `createClient`.

interface QueryParamOptions {
  value: unknown;
  style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode: boolean;
}

interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown | QueryParamOptions>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
  formData?: Record<string, unknown>;
  contentType?: string;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';
}

interface ApiRequestContext {
  url: string;
  init: RequestInit;
}

type ApiMiddleware = (
  request: ApiRequestContext,
  next: () => Promise<Response>,
) => Promise<Response>;
type ApiAuthHook = () => Record<string, string> | Promise<Record<string, string>>;
type ApiErrorMapper = (response: Response) => Promise<unknown>;
type ApiRequestHook = (request: ApiRequestContext) => void | Promise<void>;
type ApiResponseHook = (response: Response) => void | Promise<void>;

interface ClientDeps {
  baseUrl: string;
  middleware?: ReadonlyArray<ApiMiddleware>;
  auth?: ApiAuthHook;
  defaultHeaders?: Record<string, string>;
  errorMapper?: ApiErrorMapper;
  onRequest?: ApiRequestHook;
  onResponse?: ApiResponseHook;
  fetchFn: typeof fetch;
}

function appendQueryParam(
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
        url.searchParams.append(`${key}[${prop}]`, String(val));
      }
    }
  } else {
    url.searchParams.set(key, String(value));
  }
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown | QueryParamOptions>): string {
  const url = new URL(path, baseUrl);

  for (const [key, raw] of Object.entries(query ?? {})) {
    if (raw === undefined || raw === null) {
      continue;
    }

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
      appendQueryParam(url, key, opts.value, opts.style, opts.explode);
    } else {
      appendQueryParam(url, key, raw, 'form', true);
    }
  }

  return url.toString();
}

async function parseBody(
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

function prepareBody(options: ApiRequestOptions): { body: BodyInit | undefined; contentType?: string } {
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
      return {body: params.toString(), contentType: 'application/x-www-form-urlencoded'};
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
    return {body: formData};
  }

  if (options.body !== undefined) {
    if (
      options.body instanceof FormData ||
      options.body instanceof Blob ||
      options.body instanceof ArrayBuffer ||
      options.body instanceof URLSearchParams ||
      (typeof ReadableStream !== 'undefined' && options.body instanceof ReadableStream)
    ) {
      return {body: options.body as BodyInit, contentType: options.contentType};
    }
    return {body: JSON.stringify(options.body), contentType: options.contentType ?? 'application/json'};
  }

  return {body: undefined};
}

function createClient(deps: ClientDeps) {
  const middleware = deps.middleware ?? [];
  const defaultHeaders = deps.defaultHeaders ?? {};

  async function request<T>(options: ApiRequestOptions): Promise<T> {
    const url = buildUrl(deps.baseUrl, options.path, options.query);

    const authHeaders = deps.auth ? await deps.auth() : {};

    const {body, contentType} = prepareBody(options);

    function stripUndefinedHeaders(
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

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...defaultHeaders,
      ...authHeaders,
      ...(contentType ? {'Content-Type': contentType} : {}),
      ...stripUndefinedHeaders(options.headers),
    };

    const init: RequestInit = {
      method: options.method,
      ...(options.signal !== undefined ? {signal: options.signal} : {}),
      headers,
      ...(body !== undefined ? {body} : {}),
    };

    const context: ApiRequestContext = {url, init};

    if (deps.onRequest) {
      await deps.onRequest(context);
    }

    const coreFetch = async (): Promise<Response> => deps.fetchFn(context.url, context.init);

    const pipeline = middleware.reduceRight<() => Promise<Response>>(
      (next, mw) => async () => mw(context, next),
      coreFetch,
    );

    const response = await pipeline();

    if (!response.ok) {
      throw await (deps.errorMapper ?? defaultErrorMapper)(response);
    }

    if (deps.onResponse) {
      await deps.onResponse(response);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await parseBody(response, options.responseType)) as T;
  }

  return {request};
}

async function defaultErrorMapper(response: Response): Promise<Error> {
  return new Error(`HTTP ${response.status}: ${response.statusText}`);
}

describe('ApiFetchClient request logic', () => {
  const baseUrl = 'https://api.example.com';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(response: Response) {
    return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
  }

  describe('URL building', () => {
    it('builds URL with path parameters', () => {
      const url = buildUrl(baseUrl, '/users/123');
      expect(url).toBe('https://api.example.com/users/123');
    });

    it('builds URL with query parameters', () => {
      const url = buildUrl(baseUrl, '/users', {q: 'john', limit: 10});
      expect(url).toContain('q=john');
      expect(url).toContain('limit=10');
    });

    it('skips undefined and null query parameters', () => {
      const url = buildUrl(baseUrl, '/users', {q: 'test', skip: undefined, limit: null});
      expect(url).toContain('q=test');
      expect(url).not.toContain('skip');
      expect(url).not.toContain('limit');
    });

    it('handles array query parameters', () => {
      const url = buildUrl(baseUrl, '/users', {tags: ['admin', 'active']});
      expect(url).toContain('tags=admin');
      expect(url).toContain('tags=active');
    });
  });

  describe('response parsing', () => {
    it('returns parsed JSON for successful responses', async () => {
      const response = new Response(JSON.stringify({id: 1, name: 'John'}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<{id: number; name: string}>({
        method: 'GET',
        path: '/users/1',
      });

      expect(result).toEqual({id: 1, name: 'John'});
    });

    it('returns undefined for 204 No Content', async () => {
      const response = new Response(null, {status: 204});
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<void>({method: 'DELETE', path: '/users/1'});

      expect(result).toBeUndefined();
    });

    it('parses text response when responseType is text', async () => {
      const response = new Response('hello world', {
        status: 200,
        headers: {'content-type': 'text/plain'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<string>({
        method: 'GET',
        path: '/readme',
        responseType: 'text',
      });

      expect(result).toBe('hello world');
    });

    it('parses blob response when responseType is blob', async () => {
      const response = new Response(new Blob(['binary'], {type: 'image/png'}), {
        status: 200,
        headers: {'content-type': 'image/png'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<Blob>({
        method: 'GET',
        path: '/avatar.png',
        responseType: 'blob',
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
    });

    it('parses arrayBuffer response when responseType is arrayBuffer', async () => {
      const response = new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {'content-type': 'application/octet-stream'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<ArrayBuffer>({
        method: 'GET',
        path: '/data.bin',
        responseType: 'arrayBuffer',
      });

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('falls back to content-type sniffing for text/* without responseType', async () => {
      const response = new Response('plain', {
        status: 200,
        headers: {'content-type': 'text/plain'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<string>({method: 'GET', path: '/x'});

      expect(result).toBe('plain');
    });

    it('falls back to blob for binary content-type without responseType', async () => {
      const response = new Response(new Blob(['x'], {type: 'image/png'}), {
        status: 200,
        headers: {'content-type': 'image/png'},
      });
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<Blob>({method: 'GET', path: '/x'});

      expect(result).toBeInstanceOf(Blob);
    });

    it('returns undefined when content-type is missing and no responseType', async () => {
      const response = new Response('', {status: 200});
      // Node's Response defaults to text/plain; explicitly remove it to test
      // the no-content-type branch.
      response.headers.delete('content-type');
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      const result = await client.request<unknown>({method: 'GET', path: '/x'});

      expect(result).toBeUndefined();
    });
  });

  describe('headers', () => {
    it('sends JSON body with Content-Type header', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({id: 1}), {
          status: 201,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      await client.request({
        method: 'POST',
        path: '/users',
        body: {name: 'John'},
      });

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(callArgs?.body).toBe(JSON.stringify({name: 'John'}));
    });

    it('does not set Content-Type when body is undefined', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Content-Type');
    });

    it('merges default headers into every request', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({
        baseUrl,
        defaultHeaders: {'X-Client': 'ng-openapi-signals'},
        fetchFn: fetchMock,
      });

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('X-Client', 'ng-openapi-signals');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });

    it('per-request headers override default headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({
        baseUrl,
        defaultHeaders: {'X-Client': 'default'},
        fetchFn: fetchMock,
      });

      await client.request({method: 'GET', path: '/users', headers: {'X-Client': 'override'}});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('X-Client', 'override');
    });
  });

  describe('auth hook', () => {
    it('merges auth headers into every request', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({
        baseUrl,
        auth: () => ({Authorization: 'Bearer token-123'}),
        fetchFn: fetchMock,
      });

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Authorization', 'Bearer token-123');
    });

    it('supports async auth hooks', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({
        baseUrl,
        auth: async () => {
          await Promise.resolve();
          return {Authorization: 'Bearer async'};
        },
        fetchFn: fetchMock,
      });

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Authorization', 'Bearer async');
    });

    it('does not add auth headers when no auth hook is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('middleware', () => {
    it('runs middleware in onion order (first wraps second)', async () => {
      const order: string[] = [];
      const response = new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

      const mw1: ApiMiddleware = async (_req, next) => {
        order.push('mw1-before');
        const res = await next();
        order.push('mw1-after');
        return res;
      };
      const mw2: ApiMiddleware = async (_req, next) => {
        order.push('mw2-before');
        const res = await next();
        order.push('mw2-after');
        return res;
      };

      const client = createClient({baseUrl, middleware: [mw1, mw2], fetchFn});
      await client.request({method: 'GET', path: '/users'});

      expect(order).toEqual(['mw1-before', 'mw2-before', 'mw2-after', 'mw1-after']);
    });

    it('passes the request context to middleware', async () => {
      const response = new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

      let capturedUrl: string | undefined;
      const mw: ApiMiddleware = async (req, next) => {
        capturedUrl = req.url;
        return next();
      };

      const client = createClient({baseUrl, middleware: [mw], fetchFn});
      await client.request({method: 'GET', path: '/users'});

      expect(capturedUrl).toBe('https://api.example.com/users');
    });

    it('allows middleware to mutate the request init', async () => {
      const response = new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

      const mw: ApiMiddleware = async (req, next) => {
        const headers = req.init.headers as Record<string, string>;
        req.init = {...req.init, headers: {...headers, 'X-Mw': 'added'}};
        return next();
      };

      const client = createClient({baseUrl, middleware: [mw], fetchFn});
      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('X-Mw', 'added');
    });

    it('allows middleware to short-circuit with a custom response', async () => {
      const fetchFn = vi.fn() as unknown as typeof fetch;
      const customResponse = new Response(JSON.stringify({custom: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });

      const mw: ApiMiddleware = async () => customResponse;

      const client = createClient({baseUrl, middleware: [mw], fetchFn});
      const result = await client.request<{custom: boolean}>({method: 'GET', path: '/users'});

      expect(result).toEqual({custom: true});
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('calls core fetch when no middleware is provided', async () => {
      const response = new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

      const client = createClient({baseUrl, fetchFn});
      await client.request({method: 'GET', path: '/users'});

      expect(fetchFn).toHaveBeenCalledOnce();
    });
  });

  describe('error handling', () => {
    it('throws on non-OK responses using the default error mapper', async () => {
      const response = new Response('Not Found', {status: 404, statusText: 'Not Found'});
      const client = createClient({baseUrl, fetchFn: mockFetch(response)});

      await expect(
        client.request({method: 'GET', path: '/users/999'}),
      ).rejects.toThrow('HTTP 404');
    });

    it('uses a custom error mapper when provided', async () => {
      const response = new Response('Forbidden', {status: 403, statusText: 'Forbidden'});
      const customMapper: ApiErrorMapper = async (res) =>
        new Error(`Custom ${res.status}`);

      const client = createClient({baseUrl, errorMapper: customMapper, fetchFn: mockFetch(response)});

      await expect(
        client.request({method: 'GET', path: '/secret'}),
      ).rejects.toThrow('Custom 403');
    });
  });

  describe('request and response hooks', () => {
    it('calls onRequest before fetch', async () => {
      const calls: string[] = [];
      const response = new Response(JSON.stringify({}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockImplementation(async () => {
        calls.push('fetch');
        return response;
      }) as unknown as typeof fetch;

      const client = createClient({
        baseUrl,
        onRequest: () => {
          calls.push('onRequest');
        },
        fetchFn,
      });

      await client.request({method: 'GET', path: '/users'});

      expect(calls).toEqual(['onRequest', 'fetch']);
    });

    it('calls onResponse after a successful response', async () => {
      const calls: string[] = [];
      const response = new Response(JSON.stringify({}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockImplementation(async () => {
        calls.push('fetch');
        return response;
      }) as unknown as typeof fetch;

      const client = createClient({
        baseUrl,
        onResponse: () => {
          calls.push('onResponse');
        },
        fetchFn,
      });

      await client.request({method: 'GET', path: '/users'});

      expect(calls).toEqual(['fetch', 'onResponse']);
    });

    it('onRequest can mutate the request context', async () => {
      const response = new Response(JSON.stringify({}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

      const client = createClient({
        baseUrl,
        onRequest: (ctx) => {
          const headers = ctx.init.headers as Record<string, string>;
          ctx.init = {...ctx.init, headers: {...headers, 'X-Hook': 'yes'}};
        },
        fetchFn,
      });

      await client.request({method: 'GET', path: '/users'});

      const callArgs = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('X-Hook', 'yes');
    });
  });

  describe('query parameter styles', () => {
    it('serializes spaceDelimited with explode:false as space-separated', () => {
      const url = buildUrl(baseUrl, '/search', {
        tags: {value: ['a', 'b'], style: 'spaceDelimited', explode: false},
      });
      // URLSearchParams encodes spaces as +
      expect(url).toContain('tags=a+b');
    });

    it('serializes pipeDelimited with explode:false as pipe-separated', () => {
      const url = buildUrl(baseUrl, '/search', {
        categories: {value: ['x', 'y'], style: 'pipeDelimited', explode: false},
      });
      expect(url).toContain('categories=x%7Cy');
    });

    it('serializes form with explode:false as comma-separated', () => {
      const url = buildUrl(baseUrl, '/search', {
        ids: {value: [1, 2, 3], style: 'form', explode: false},
      });
      expect(url).toContain('ids=1%2C2%2C3');
    });

    it('serializes deepObject with explode:true as nested keys', () => {
      const url = buildUrl(baseUrl, '/search', {
        filters: {value: {status: 'active', role: 'admin'}, style: 'deepObject', explode: true},
      });
      expect(url).toContain('filters%5Bstatus%5D=active');
      expect(url).toContain('filters%5Brole%5D=admin');
    });

    it('serializes form with explode:true as repeated keys (default)', () => {
      const url = buildUrl(baseUrl, '/search', {
        tags: {value: ['a', 'b'], style: 'form', explode: true},
      });
      expect(url).toContain('tags=a');
      expect(url).toContain('tags=b');
      expect(url).not.toContain('tags=a%2Cb');
    });

    it('passes plain values through as default form+explode:true', () => {
      const url = buildUrl(baseUrl, '/search', {q: 'test', limit: 10});
      expect(url).toContain('q=test');
      expect(url).toContain('limit=10');
    });
  });

  describe('FormData and binary body handling', () => {
    it('builds FormData from formData object for multipart', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({url: 'ok'}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      const blob = new Blob(['file-content'], {type: 'image/png'});
      await client.request({
        method: 'POST',
        path: '/upload',
        formData: {file: blob, caption: 'test'},
        contentType: 'multipart/form-data',
      });

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      expect(callArgs?.body).toBeInstanceOf(FormData);
      // Content-Type should NOT be set for multipart (browser sets boundary)
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Content-Type');
    });

    it('builds URLSearchParams for application/x-www-form-urlencoded', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({created: 1}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      await client.request({
        method: 'POST',
        path: '/bulk',
        formData: {names: 'a,b', count: 1},
        contentType: 'application/x-www-form-urlencoded',
      });

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      expect(callArgs?.body).toBe('names=a%2Cb&count=1');
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded');
    });

    it('passes Blob body through without JSON.stringify', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      const blob = new Blob(['binary'], {type: 'application/octet-stream'});
      await client.request({
        method: 'POST',
        path: '/upload',
        body: blob,
        contentType: 'application/octet-stream',
      });

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      expect(callArgs?.body).toBe(blob);
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Content-Type', 'application/octet-stream');
    });

    it('uses custom contentType for JSON body when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {'content-type': 'application/json'},
        }),
      ) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn: fetchMock});

      await client.request({
        method: 'POST',
        path: '/data',
        body: {key: 'value'},
        contentType: 'application/vnd.custom+json',
      });

      const callArgs = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
      const headers = callArgs?.headers as Record<string, string>;
      expect(headers).toHaveProperty('Content-Type', 'application/vnd.custom+json');
    });
  });

  describe('stream response parsing', () => {
    it('returns response.body for responseType: stream', async () => {
      const stream = new ReadableStream();
      const response = new Response(stream, {
        status: 200,
        headers: {'content-type': 'text/event-stream'},
      });
      const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
      const client = createClient({baseUrl, fetchFn});

      const result = await client.request<ReadableStream>({
        method: 'GET',
        path: '/events',
        responseType: 'stream',
      });

      expect(result).toBe(response.body);
    });
  });
});