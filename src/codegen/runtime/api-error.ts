import type {GeneratorConfig} from '../types';

export function generateApiError(config: GeneratorConfig): string {
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