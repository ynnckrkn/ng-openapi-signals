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

### Signal-based mutations (opt-in)

When `runtime.signalMutations` is enabled (default `false`, CLI `--signal-mutations`),
the generator additionally emits a `${operationId}Mutation()` method for every
POST/PUT/PATCH/DELETE endpoint, alongside the existing Promise-based method.
The feature is strictly additive — the Promise-based methods remain unchanged.

The mutation method returns a `Mutation<TBody, TResult>` object exposing
reactive signals:

| Member     | Type                              | Description                                              |
| ---------- | --------------------------------- | -------------------------------------------------------- |
| `result`   | `Signal<TResult \| undefined>`    | Last successful response value (or `undefined`)          |
| `error`    | `Signal<unknown \| undefined>`    | Last thrown error (or `undefined`)                       |
| `status`   | `Signal<MutationStatus>`          | `'idle' \| 'loading' \| 'success' \| 'error'`            |
| `isLoading`| `Signal<boolean>`                 | `computed(() => status() === 'loading')`                |
| `mutate`   | `(body, signal?) => Promise<TResult>` | Triggers the request, updates signals, resolves to the result |
| `reset`    | `() => void`                      | Clears `result`/`error` and returns `status` to `'idle'` |

#### Basic usage

```ts
readonly creating = this.usersApi.createUserMutation();

create(): void {
  // `mutate()` returns a Promise (you can `await` it), but the reactive
  // signals update regardless of whether you await.
  this.creating.mutate({ name: 'John Doe', email: 'john@example.com' });
}
```

Template:

```html
<button (click)="create()" [disabled]="creating.isLoading()">
  {{ creating.isLoading() ? 'Creating…' : 'Create user' }}
</button>

@if (creating.error()) {
  <p class="error">Failed to create user.</p>
}

@if (creating.result(); as user) {
  <p>Created user: {{ user.name }} ({{ user.email }})</p>
}
```

#### Endpoints with parameters

For endpoints with path/query/header parameters, the parameters are bound at
construction time (captured in the closure) and accept plain values or signals
(like the `resource()` variants). Only the request body is passed to `mutate()`:

```ts
readonly userId = signal('usr_123');

readonly uploading = this.usersApi.uploadUserAvatarMutation({
  id: this.userId,  // signal — read when `mutate()` is invoked
});

upload(): void {
  this.uploading.mutate({ file: this.file, caption: 'Profile photo' });
}
```

#### Reset

Call `reset()` to clear `result` and `error` and return the mutation to the
`'idle'` status — useful when navigating away or re-opening a form:

```ts
ngOnDestroy(): void {
  this.creating.reset();
}
```

#### Enabling the feature

Via config file:

```ts
export default defineConfig({
  // ...
  runtime: { signalMutations: true },
});
```

Or via CLI:

```bash
ng-openapi-signals generate --signal-mutations
```

When enabled, the generator emits an additional `mutation-utils.ts` runtime
file containing the `Mutation` interface and `createMutation` factory.

#### `Mutation` interface

```ts
export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Mutation<TBody, TResult> {
  readonly result: Signal<TResult | undefined>;
  readonly error: Signal<unknown | undefined>;
  readonly status: Signal<MutationStatus>;
  readonly isLoading: Signal<boolean>;
  mutate(body: TBody, signal?: AbortSignal): Promise<TResult>;
  reset(): void;
}
```

---

## Runtime

The generated client includes a small runtime:

```text
api-fetch-client.ts   (or api-http-client.ts)
api-error.ts
signal-utils.ts
mutation-utils.ts     (only when runtime.signalMutations is enabled)
providers.ts
```

### `ApiFetchClient`

The generated `ApiFetchClient` wraps native `fetch()` and handles:

- Base URL handling
- JSON request bodies
- Multipart form data (`FormData`) and `application/x-www-form-urlencoded` (`URLSearchParams`)
- `Blob`/`ArrayBuffer` body passthrough (no JSON serialization)
- Custom request content types
- JSON, text, `Blob`, `ArrayBuffer` and `ReadableStream` responses (spec-driven with content-type fallback)
- Query parameters with OpenAPI `style`/`explode` serialization
- Header parameters
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
- Multipart form data (`FormData`) and `application/x-www-form-urlencoded` (`URLSearchParams`)
- `Blob`/`ArrayBuffer` body passthrough
- Custom request content types
- JSON, text, `Blob`, `ArrayBuffer` and stream responses (`stream` maps to `blob` — Angular `HttpClient` has no native stream; call `.stream()` on the returned `Blob`)
- Query parameters with OpenAPI `style`/`explode` serialization
- Header parameters
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
| `text/event-stream`                                            | `'stream'`     | `string` (fetch: `ReadableStream`, httpClient: `Blob`) |
| `image/*`, `audio/*`, `video/*`, `octet-stream`, `multipart/*` | `'blob'`       | `Blob`                 |

For responses without a known content type the runtime falls back to
content-type sniffing. Set `runtime.responseTypeHints: false` in the config
file to disable hints and rely solely on runtime sniffing.

### `ApiRequestOptions`

The generated methods call `this.client.request<T>(options)` with these fields:

| Field         | Type                                              | Description                                                              |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `method`      | `string`                                          | HTTP method (`'GET'`, `'POST'`, ...)                                     |
| `path`        | `string`                                          | URL path (with path params interpolated)                                |
| `query`       | `Record<string, unknown \| QueryParamOptions>`    | Query params (plain values or wrapped with style/explode metadata)     |
| `headers`     | `Record<string, string>`                       | Per-request headers (merged over defaults)                               |
| `body`        | `unknown`                                         | Request body (JSON-serialized unless `FormData`/`Blob`/`ArrayBuffer`)    |
| `formData`    | `Record<string, unknown>`                       | Form data object (built into `FormData` or `URLSearchParams` by runtime) |
| `contentType` | `string`                                          | Explicit Content-Type (defaults to `application/json` for JSON bodies)  |
| `signal`     | `AbortSignal`                                     | Abort signal for cancellation                                            |
| `responseType`| `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'stream'` | Response parser hint                                                     |

### Query Parameter Serialization

For parameters with non-default OpenAPI `style`/`explode`, the generated code
wraps the value with metadata so the runtime can serialize it correctly:

```ts
query: {
  tags: { value: params.tags, style: 'spaceDelimited', explode: false },
  q: params.q,  // default style: form + explode:true — plain value
}
```

The runtime `buildUrl` method serializes according to the style:

| Style             | `explode: true`           | `explode: false`           |
| ----------------- | -------------------------- | -------------------------- |
| `form`            | `key=val1&key=val2`        | `key=val1,val2`             |
| `spaceDelimited`  | `key=val1&key=val2`        | `key=val1%20val2`           |
| `pipeDelimited`   | `key=val1&key=val2`        | `key=val1\|val2`            |
| `deepObject`      | `key[prop]=val`            | —                          |

### Multipart Form Data

When a request body uses `multipart/form-data`, the generated method passes
`formData: body` instead of `body:`. The runtime builds a `FormData` object:

- `Blob` values are appended directly (no serialization)
- Other values are converted to strings
- The browser sets the `Content-Type` with the multipart boundary automatically

For `application/x-www-form-urlencoded`, the runtime builds `URLSearchParams`.

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

## Middleware with Dependency Injection

Middleware functions are registered as plain function values via
`provideNgOpenapiSignals({ middleware: [...] })`. Because they run
asynchronously outside an Angular injection context, calling `inject()`
inside a middleware closure throws `NG0203: inject() must be called from
an injection context`.

The recommended pattern for middleware that needs Angular dependencies is
an `@Injectable()` service that exposes the middleware as an arrow-function
property. The service is instantiated within an injection context, so
`inject()` works in field initializers, and the arrow property keeps `this`
bound when the function reference is passed into the middleware array.

```ts
// logging.middleware.ts
import { Injectable } from '@angular/core';
import { ApiRequestContext } from './generated/api';

@Service()
export class LoggingMiddleware {
  // Dependencies injected in field initializers — works because the
  // service is instantiated within an injection context.
  // private readonly logger = inject(LoggerService);

  // Arrow-function property: `this` stays bound when passed as a reference.
  readonly __call = async (
    req: ApiRequestContext,
    next: () => Promise<Response>,
  ): Promise<Response> => {
    console.log('→', req.init.method, req.url);
    const res = await next();
    console.log('←', res.status);
    return res;
  };
}
```

Register the service instance in `provideNgOpenapiSignals()`:

```ts
// app.config.ts
import { ApplicationConfig, inject } from '@angular/core';
import { provideNgOpenapiSignals } from './generated/api';
import { LoggingMiddleware } from './logging.middleware';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgOpenapiSignals({
      basePath: 'https://api.example.com',
      middleware: [inject(LoggingMiddleware).__call],
    }),
  ],
};
```

### Example: auth middleware with DI

```ts
// auth.middleware.ts
import { Injectable, inject } from '@angular/core';
import { ApiRequestContext } from './generated/api';

@Service()
export class AuthMiddleware {
  private readonly authService = inject(AuthService);

  readonly __call = async (
    req: ApiRequestContext,
    next: () => Promise<Response>,
  ): Promise<Response> => {
    const token = this.authService.token(); // signal-based token
    req.init.headers = {
      ...req.init.headers,
      Authorization: `Bearer ${token}`,
    };
    return next();
  };
}
```

```ts
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideNgOpenapiSignals({
      basePath: 'https://api.example.com',
      // Order matters: reduceRight means the first array element is the
      // outermost layer (runs first on the request, last on the response).
      middleware: [
        inject(LoggingMiddleware).__call,
        inject(AuthMiddleware).__call,
      ],
    }),
  ],
};
```

### Why a service instead of a plain closure?

| Approach | DI works? | Testable? | Tree-shakable? |
| --- | --- | --- | --- |
| Plain closure in `middleware: [...]` | ❌ `NG0203` | manual | no |
| `inject(Injector)` + `injector.get()` | ⚠️ manual | manual | no |
| `@Injectable()` service + arrow property | ✅ full DI | ✅ `TestBed` | ✅ |

> **Note:** This pattern applies to the `fetch` transport only. When using
> `transport: 'httpClient'`, use Angular `HttpInterceptorFn` or class-based
> `HttpInterceptor` instead — the middleware array is not emitted for the
> `httpClient` transport.