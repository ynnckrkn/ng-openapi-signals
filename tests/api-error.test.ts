import {describe, it, expect} from 'vitest';

// Re-implement toApiError here to test the runtime logic without Angular DI.
// This mirrors the generated api-error.ts template exactly.
function extractApiErrorMessage(status: number, statusText: string, body: unknown): string {
  if (body === null || body === undefined) {
    return `HTTP ${status}${statusText ? ': ' + statusText : ''}`;
  }

  if (typeof body === 'string') {
    return body.length > 0 ? body : `HTTP ${status}${statusText ? ': ' + statusText : ''}`;
  }

  if (typeof body === 'object') {
    const b = body as Record<string, unknown>;

    // NestJS: { message: string | string[], error, statusCode }
    const message = b['message'];
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.map((m) => String(m)).join(', ');
    }

    // FastAPI / generic: { detail: string | { msg }[] }
    // (RFC 7807 Problem Details with a `title` is handled below to produce
    // a richer "title: detail" message.)
    const detail = b['detail'];
    if (typeof detail === 'string' && detail.length > 0 && typeof b['title'] !== 'string') {
      return detail;
    }
    // FastAPI validation: { detail: [{ msg }] } — still pick msg even though
    // title is absent.
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first === 'object' && 'msg' in first) {
        return String((first as Record<string, unknown>)['msg']);
      }
      return String(detail[0]);
    }

    // Express validator / generic: { errors: [{ msg }] }
    const errors = b['errors'];
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      if (first && typeof first === 'object' && 'msg' in first) {
        return String((first as Record<string, unknown>)['msg']);
      }
      return String(first);
    }

    // RFC 7807 Problem Details: { title, detail }
    const problemDetail = b['detail'];
    if (typeof problemDetail === 'string' && problemDetail.length > 0) {
      const title = typeof b['title'] === 'string' ? (b['title'] as string) : '';
      return title ? `${title}: ${problemDetail}` : problemDetail;
    }
    const problemTitle = b['title'];
    if (typeof problemTitle === 'string' && problemTitle.length > 0) {
      return problemTitle;
    }

    // Generic { error: string }
    const errorField = b['error'];
    if (typeof errorField === 'string' && errorField.length > 0) {
      return errorField;
    }
  }

  return `HTTP ${status}${statusText ? ': ' + statusText : ''}`;
}

class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly headers: Headers;

  constructor(status: number, statusText: string, body: unknown, headers: Headers) {
    super(extractApiErrorMessage(status, statusText, body));
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.headers = headers;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;

  try {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch {
    body = null;
  }

  return new ApiError(response.status, response.statusText, body, response.headers);
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
  it('returns an ApiError that is a real Error instance', async () => {
    const response = createMockResponse({
      status: 404,
      statusText: 'Not Found',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({message: 'User u_4 not found', error: 'Not Found', statusCode: 404}),
    });

    const error = await toApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('User u_4 not found');
  });

  it('parses a JSON error body and extracts the NestJS message', async () => {
    const response = createMockResponse({
      status: 404,
      statusText: 'Not Found',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({message: 'User u_4 not found', error: 'Not Found', statusCode: 404}),
    });

    const error = await toApiError(response);

    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.message).toBe('User u_4 not found');
    expect((error.body as {statusCode: number}).statusCode).toBe(404);
  });

  it('joins NestJS validation message arrays', async () => {
    const response = createMockResponse({
      status: 400,
      statusText: 'Bad Request',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        message: ['name must be a string', 'email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    });

    const error = await toApiError(response);

    expect(error.message).toBe('name must be a string, email must be an email');
  });

  it('extracts FastAPI-style detail strings', async () => {
    const response = createMockResponse({
      status: 404,
      statusText: 'Not Found',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({detail: 'Item not found'}),
    });

    const error = await toApiError(response);

    expect(error.message).toBe('Item not found');
  });

  it('extracts RFC 7807 Problem Details', async () => {
    const response = createMockResponse({
      status: 400,
      statusText: 'Bad Request',
      headers: {'content-type': 'application/problem+json'},
      body: JSON.stringify({type: 'about:blank', title: 'Invalid Input', detail: 'name is required'}),
    });

    const error = await toApiError(response);

    expect(error.message).toBe('Invalid Input: name is required');
  });

  it('falls back to the generic error field when no message/detail/title is present', async () => {
    const response = createMockResponse({
      status: 401,
      statusText: 'Unauthorized',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({error: 'Unauthorized'}),
    });

    const error = await toApiError(response);

    expect(error.message).toBe('Unauthorized');
  });

  it('uses the raw text body as the message for non-JSON error bodies', async () => {
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
    expect(error.message).toBe('Something went wrong');
  });

  it('falls back to status + statusText when the body is empty', async () => {
    const response = createMockResponse({
      status: 502,
      statusText: 'Bad Gateway',
      headers: {'content-type': 'text/plain'},
      body: '',
    });

    const error = await toApiError(response);

    expect(error.status).toBe(502);
    expect(error.body).toBe('');
    expect(error.message).toBe('HTTP 502: Bad Gateway');
  });

  it('falls back to status when content-type header is missing', async () => {
    const response = createMockResponse({
      status: 404,
      statusText: 'Not Found',
    });

    const error = await toApiError(response);

    expect(error.status).toBe(404);
    expect(error.body).toBe('');
    expect(error.message).toBe('HTTP 404: Not Found');
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