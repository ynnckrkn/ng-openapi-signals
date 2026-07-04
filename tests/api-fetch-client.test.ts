import {describe, it, expect, vi, afterEach} from 'vitest';

// Test the ApiFetchClient request logic by mocking fetch.
// We re-implement the core logic here to avoid Angular DI dependencies,
// mirroring the generated api-fetch-client.ts template.

interface ApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
        void item;
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function request<T>(
  baseUrl: string,
  options: ApiRequestOptions,
  fetchFn: typeof fetch,
): Promise<T> {
  const url = buildUrl(baseUrl, options.path, options.query);

  const fetchInit: RequestInit = {
    method: options.method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? {'Content-Type': 'application/json'} : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
  };

  if (options.signal !== undefined) {
    fetchInit.signal = options.signal;
  }

  const response = await fetchFn(url, fetchInit);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

describe('ApiFetchClient request logic', () => {
  const baseUrl = 'https://api.example.com';

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('returns parsed JSON for successful responses', async () => {
    const mockResponse = new Response(JSON.stringify({id: 1, name: 'John'}), {
      status: 200,
      headers: {'content-type': 'application/json'},
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);

    const result = await request<{id: number; name: string}>(
      baseUrl,
      {method: 'GET', path: '/users/1'},
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({id: 1, name: 'John'});
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns undefined for 204 No Content', async () => {
    const mockResponse = new Response(null, {
      status: 204,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);

    const result = await request<void>(
      baseUrl,
      {method: 'DELETE', path: '/users/1'},
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toBeUndefined();
  });

  it('throws on non-OK responses', async () => {
    const mockResponse = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      request(baseUrl, {method: 'GET', path: '/users/999'}, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow('HTTP 404');
  });

  it('sends JSON body with Content-Type header', async () => {
    const mockResponse = new Response(JSON.stringify({id: 1}), {
      status: 201,
      headers: {'content-type': 'application/json'},
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);

    await request(
      baseUrl,
      {
        method: 'POST',
        path: '/users',
        body: {name: 'John'},
      },
      fetchMock as unknown as typeof fetch,
    );

    const callArgs = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(callArgs?.headers).toHaveProperty('Content-Type', 'application/json');
    expect(callArgs?.body).toBe(JSON.stringify({name: 'John'}));
  });

  it('does not set Content-Type when body is undefined', async () => {
    const mockResponse = new Response(JSON.stringify([]), {
      status: 200,
      headers: {'content-type': 'application/json'},
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);

    await request(
      baseUrl,
      {method: 'GET', path: '/users'},
      fetchMock as unknown as typeof fetch,
    );

    const callArgs = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = callArgs?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Content-Type');
  });
});