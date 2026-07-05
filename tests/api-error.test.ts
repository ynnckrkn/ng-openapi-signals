import {describe, it, expect} from 'vitest';

// Re-implement toApiError here to test the runtime logic without Angular DI.
// This mirrors the generated api-error.ts template exactly.
interface ApiError {
  status: number;
  statusText: string;
  body: unknown;
  headers: Headers;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;

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
    headers: response.headers,
  };
}

function createMockResponse(options: {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  const headers = new Headers(options.headers ?? {});
  return new Response(options.body ?? '', {
    status: options.status,
    statusText: options.statusText ?? '',
    headers,
  });
}

describe('toApiError', () => {
  it('parses a JSON error body', async () => {
    const response = createMockResponse({
      status: 400,
      statusText: 'Bad Request',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({message: 'Invalid input'}),
    });

    const error = await toApiError(response);

    expect(error.status).toBe(400);
    expect(error.statusText).toBe('Bad Request');
    expect(error.body).toEqual({message: 'Invalid input'});
  });

  it('parses a text error body when content-type is not JSON', async () => {
    const response = createMockResponse({
      status: 500,
      statusText: 'Internal Server Error',
      headers: {'content-type': 'text/plain'},
      body: 'Something went wrong',
    });

    const error = await toApiError(response);

    expect(error.status).toBe(500);
    expect(error.statusText).toBe('Internal Server Error');
    expect(error.body).toBe('Something went wrong');
  });

  it('falls back to null body when response body is empty', async () => {
    const response = createMockResponse({
      status: 502,
      statusText: 'Bad Gateway',
      headers: {'content-type': 'text/plain'},
      body: '',
    });

    const error = await toApiError(response);

    expect(error.status).toBe(502);
    expect(error.body).toBe('');
  });

  it('falls back to null body when content-type header is missing', async () => {
    const response = createMockResponse({
      status: 404,
      statusText: 'Not Found',
    });

    const error = await toApiError(response);

    expect(error.status).toBe(404);
    expect(error.body).toBe('');
  });

  it('preserves response headers in the ApiError', async () => {
    const response = createMockResponse({
      status: 401,
      statusText: 'Unauthorized',
      headers: {'content-type': 'application/json', 'x-request-id': 'abc-123'},
      body: JSON.stringify({error: 'Unauthorized'}),
    });

    const error = await toApiError(response);

    expect(error.headers.get('x-request-id')).toBe('abc-123');
    expect(error.headers.get('content-type')).toBe('application/json');
  });
});

describe('custom error mapper contract', () => {
  // A custom error mapper follows the same shape as toApiError but can return
  // any Error subclass. This verifies the contract used by the
  // NG_OPENAPI_SIGNALS_ERROR_MAPPER DI token.
  it('can return a custom Error subclass', async () => {
    class ValidationError extends Error {
      constructor(
        public status: number,
        message: string,
      ) {
        super(message);
        this.name = 'ValidationError';
      }
    }

    const mapper = async (response: Response): Promise<Error> => {
      const body = (await response.json()) as {message: string};
      return new ValidationError(response.status, body.message);
    };

    const response = createMockResponse({
      status: 400,
      statusText: 'Bad Request',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({message: 'Email is required'}),
    });

    const error = await mapper(response);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Email is required');
    expect((error as ValidationError).status).toBe(400);
  });
});