# Generated API Style & Runtime

Detailed reference for the generated API patterns and runtime internals.

## Generated API Style

### GET endpoints

GET endpoints are generated as Angular `resource()` APIs.

Example OpenAPI operation:

```text
GET /users/{id}
```

Generated usage:

```ts
readonly user = this.usersApi.getUserByIdResource({
  id: this.userId
});
```

The generated method accepts regular values or signals:

```ts
readonly user = this.usersApi.getUserByIdResource({
  id: '123'
});
```

or:

```ts
readonly userId = signal('123');

readonly user = this.usersApi.getUserByIdResource({
  id: this.userId
});
```

### Mutating endpoints

POST, PUT, PATCH and DELETE endpoints are generated as Promise-based methods using `fetch()`.

Example:

```ts
await this.usersApi.createUser({
  name: 'John Doe',
  email: 'john@example.com',
});
```

This keeps read operations reactive while keeping write operations explicit and predictable.

---

## Runtime

The generated client includes a small runtime:

```text
api-fetch-client.ts   (or api-http-client.ts)
api-error.ts
signal-utils.ts
providers.ts
```

### `ApiFetchClient`

The generated `ApiFetchClient` wraps native `fetch()` and handles:

- Base URL handling
- JSON request bodies
- JSON, text, `Blob` and `ArrayBuffer` responses (spec-driven with content-type fallback)
- Query parameters
- Abort signals
- Default headers (static via config + runtime via `auth` hook)
- Onion-style fetch middleware
- Request and response hooks
- Custom error mapping

### `ApiHttpClient`

When `transport: 'httpClient'` is selected, the generator emits `ApiHttpClient`
instead of `ApiFetchClient`. It wraps Angular `HttpClient` and handles:

- Base URL handling
- JSON request bodies
- JSON, text, `Blob` and `ArrayBuffer` responses
- Query parameters
- Abort signals
- Default headers (static via config + runtime via `auth` hook)
- Request and response hooks
- Custom error mapping (via `toApiErrorFromHttpErrorResponse`)

`provideNgOpenapiSignals()` does **not** include `provideHttpClient()` — when
using the `httpClient` transport, register `provideHttpClient()` yourself (e.g.
`provideHttpClient(withInterceptors([...]))`) so you keep full control over
interceptors and their order.

### `provideNgOpenapiSignals()`

The generated helper configures the runtime. See [Runtime Configuration](#runtime-configuration) for the full options.

```ts
import {provideNgOpenapiSignals} from './generated/api';

providers: [
  provideNgOpenapiSignals({
    basePath: 'https://api.example.com',
  }),
];
```

### `MaybeSignal<T>`

Generated resource methods support both plain values and Angular signals.

```ts
export type MaybeSignal<T> = T | Signal<T>;
```

This allows flexible usage:

```ts
api.getUserByIdResource({
  id: '123',
});
```

or:

```ts
api.getUserByIdResource({
  id: signal('123'),
});
```

### Response parsing

Generated methods emit a `responseType` hint derived from the OpenAPI response
`content` type, so the runtime picks the right parser:

| OpenAPI content type                                           | `responseType` | TypeScript return type |
| -------------------------------------------------------------- | -------------- | ---------------------- |
| `application/json` (and `*+json`)                              | `'json'`       | inferred from schema   |
| `text/*`                                                       | `'text'`       | `string`               |
| `image/*`, `audio/*`, `video/*`, `octet-stream`, `multipart/*` | `'blob'`       | `Blob`                 |

For responses without a known content type the runtime falls back to
content-type sniffing. Set `runtime.responseTypeHints: false` in the config
file to disable hints and rely solely on runtime sniffing.

---

## Runtime Configuration

`provideNgOpenapiSignals()` accepts optional runtime extension points. All are
optional — without them the client behaves as a plain `fetch()` wrapper.

```ts
provideNgOpenapiSignals({
  basePath: 'https://api.example.com',

  // Static default headers merged into every request.
  defaultHeaders: {'X-Client': 'my-app'},

  // Called once per request to add auth headers (e.g. a bearer token).
  auth: () => ({Authorization: `Bearer ${token()}`}),

  // Onion-style middleware: (request, next) => Promise<Response>.
  middleware: [
    async (req, next) => {
      console.log('→', req.init.method, req.url);
      const res = await next();
      console.log('←', res.status);
      return res;
    },
  ],

  // Called before the middleware pipeline runs. Can mutate the request.
  onRequest: (ctx) => {
    ctx.init.headers = {...ctx.init.headers, 'X-Trace-Id': crypto.randomUUID()};
  },

  // Called after a successful response is received.
  onResponse: (res) => console.log('response', res.status),

  // Replaces the default `toApiError` error mapper.
  errorMapper: async (res) => new MyApiError(await res.json()),
});
```