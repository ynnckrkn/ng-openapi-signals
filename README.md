# ng-openapi-signals

Signal-first OpenAPI client generator for Angular using `resource()` and `fetch()`.

`ng-openapi-signals` generates lightweight Angular API clients from OpenAPI specifications.
GET endpoints are generated as Angular `resource()` APIs, while mutating endpoints such as POST, PUT, PATCH and DELETE are generated as Promise-based `fetch()` methods.

## Features

- Generate Angular API clients from OpenAPI 3.x specifications
- Signal-first read APIs using Angular `resource()`
- Lightweight runtime based on native `fetch()`
- No dependency on Angular `HttpClient` (optional `httpClient` transport available)
- Typed models generated from OpenAPI schemas
- Path parameter support
- Query parameter support
- JSON request body support
- JSON, text, `Blob` and `ArrayBuffer` response handling
- Fetch middleware (onion-style `(request, next) => response`)
- Auth header hooks
- Custom default headers
- Custom error mapping
- Request and response hooks
- Base URL configuration via `provideNgOpenapiSignals()`

## Requirements

- Node.js 24 or newer
- Angular 22 or newer
- TypeScript
- OpenAPI 3.x JSON or YAML specification

---

## How to Start

Get up and running in four steps.

### 1. Install

```bash
npm install -D ng-openapi-signals
```

Or run it directly with `npx` (no install needed):

```bash
npx ng-openapi-signals generate --input openapi.json --output src/generated/api
```

### 2. Generate the API client

Create a config file `ng-openapi-signals.config.ts` in your project root (recommended):

```ts
import {defineConfig} from 'ng-openapi-signals/config';

export default defineConfig({
  input: './openapi.json',
  output: './src/generated/api',
});
```

Then run:

```bash
ng-openapi-signals generate --config ng-openapi-signals.config.ts
```

Or generate without a config file:

```bash
ng-openapi-signals generate \
  --input ./openapi.json \
  --output ./src/generated/api
```

This generates an Angular API client in `src/generated/api`:

```text
src/generated/api/
  api-fetch-client.ts
  api-error.ts
  signal-utils.ts
  providers.ts
  index.ts
  models/
    user.ts
    create-user-request.ts
    index.ts
  resources/
    users.api.ts
    index.ts
```

### 3. Configure Angular

Provide the API base URL in your application config:

```ts
import {ApplicationConfig} from '@angular/core';
import {provideNgOpenapiSignals} from './generated/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgOpenapiSignals({
      basePath: 'https://api.example.com',
    }),
  ],
};
```

### 4. Use the generated API

```ts
import {Component, inject, signal} from '@angular/core';
import {UsersApi} from './generated/api';

@Component({
  selector: 'app-user-detail',
  template: `
    @if (user.isLoading()) {
      <p>Loading...</p>
    }

    @if (user.error()) {
      <p>Something went wrong.</p>
    }

    @if (user.hasValue()) {
      <h1>{{ user.value().name }}</h1>
    }
  `,
})
export class UserDetailComponent {
  private readonly usersApi = inject(UsersApi);

  readonly userId = signal('123');

  readonly user = this.usersApi.getUserByIdResource({
    id: this.userId,
  });
}
```

That's it — you now have a fully typed, signal-first Angular API client.

---

## CLI Usage

### Generate

```bash
ng-openapi-signals generate --input <openapi-file> --output <output-directory>
```

### Options

| Option                            | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `-i, --input <path>`              | Path to the OpenAPI JSON or YAML file                         |
| `-o, --output <path>`             | Output directory for the generated Angular client             |
| `-c, --config <path>`             | Path to config file (default: `ng-openapi-signals.config.ts`) |
| `--clean`                         | Clean output directory before generation (default: true)      |
| `--no-clean`                      | Preserve existing files in output directory                   |
| `--group-by <tag\|path>`          | Group APIs by tag or path (default: tag)                      |
| `--transport <fetch\|httpClient>` | HTTP transport (default: fetch)                               |

### Recommended: use a config file

Using a config file keeps your setup reproducible and version-controllable.

```ts
// ng-openapi-signals.config.ts
import {defineConfig} from 'ng-openapi-signals/config';

export default defineConfig({
  input: './openapi.json',
  output: './src/generated/api',
  clean: true,
  groupBy: 'tag',
});
```

Then add a script to your `package.json`:

```json
{
  "scripts": {
    "generate:api": "ng-openapi-signals generate --config ng-openapi-signals.config.ts"
  }
}
```

Run it with:

```bash
npm run generate:api
```

You can also generate the API client before building your Angular app:

```json
{
  "scripts": {
    "generate:api": "ng-openapi-signals generate --config ng-openapi-signals.config.ts",
    "build": "npm run generate:api && ng build",
    "start": "npm run generate:api && ng serve"
  }
}
```

### CLI overrides

CLI flags override config file values. Config file values override defaults.

```bash
ng-openapi-signals generate \
  --input ./openapi.json \
  --output ./src/generated/api \
  --group-by path
```

---

## Generated API Style

- **GET endpoints** → Angular `resource()` APIs (accept plain values or signals)
- **POST / PUT / PATCH / DELETE** → Promise-based `fetch()` methods

```ts
// GET — reactive resource
readonly user = this.usersApi.getUserByIdResource({
  id: this.userId,  // signal or plain value
});

// POST — promise-based mutation
await this.usersApi.createUser({
  name: 'John Doe',
  email: 'john@example.com',
});
```

> See [`RUNTIME.md`](./RUNTIME.md) for full details on `MaybeSignal<T>`, response parsing, and more.

---

## Runtime

The generated client includes a small runtime:

```text
api-fetch-client.ts   (or api-http-client.ts)
api-error.ts
signal-utils.ts
providers.ts
```

- **`ApiFetchClient`** — wraps native `fetch()`, handles base URL, JSON/text/Blob responses, query params, abort signals, middleware, hooks, and error mapping.
- **`ApiHttpClient`** — wraps Angular `HttpClient` (when `transport: 'httpClient'`), same feature set, integrates with `HttpInterceptors`.
- **`provideNgOpenapiSignals()`** — configures the runtime (base URL, headers, auth, middleware, hooks, error mapper).

> See [`RUNTIME.md`](./RUNTIME.md) for the full `provideNgOpenapiSignals()` API and all runtime extension points.

---

## Configuration

`ng-openapi-signals` supports an optional config file for project-level defaults.

### Options

| Option    | Type              | Default | Description                                             |
| --------- | ----------------- | ------- | ------------------------------------------------------- |
| `input`   | `string`          | —       | Path to the OpenAPI JSON or YAML file                   |
| `output`  | `string`          | —       | Output directory for the generated Angular client       |
| `clean`   | `boolean`         | `true`  | Clean output directory before generation                |
| `groupBy` | `'tag' \| 'path'` | `'tag'` | Group generated APIs by OpenAPI tag or URL path segment |
| `runtime` | `RuntimeConfig`   | `{}`    | Runtime options (see below)                             |

#### `runtime`

| Option              | Type                      | Default   | Description                                                                |
| ------------------- | ------------------------- | --------- | -------------------------------------------------------------------------- |
| `transport`         | `'fetch' \| 'httpClient'` | `'fetch'` | HTTP transport (`fetch` = native fetch, `httpClient` = Angular HttpClient) |
| `defaultHeaders`    | `Record<string, string>`  | `{}`      | Static default headers baked into `provideNgOpenapiSignals` defaults       |
| `responseTypeHints` | `boolean`                 | `true`    | Emit `responseType` hints in generated methods based on response content   |

### Using the `httpClient` transport

By default the generated runtime uses native `fetch()`.
To use Angular `HttpClient` instead (e.g. to integrate with `HttpInterceptors`), set `transport: 'httpClient'`:

```ts
// ng-openapi-signals.config.ts
import {defineConfig} from 'ng-openapi-signals/config';

export default defineConfig({
  input: './openapi.json',
  output: './src/generated/api',
  runtime: {
    transport: 'httpClient',
  },
});
```

Or via the CLI:

```bash
ng-openapi-signals generate --input ./openapi.json --output ./src/generated/api --transport httpClient
```

When `httpClient` is selected:

- The generator emits `ApiHttpClient` instead of `ApiFetchClient`.
- `provideNgOpenapiSignals()` does **not** include `provideHttpClient()` — register it yourself in your app config (e.g. `provideHttpClient(withInterceptors([...]))`) so you keep full control over interceptors and their order.
- The `NG_OPENAPI_SIGNALS_MIDDLEWARE` token is not emitted.
- Generated API service methods (`resource()` loaders, mutations) remain identical — only the underlying client changes.

### Grouping

By default, APIs are grouped by OpenAPI tag (`groupBy: 'tag'`).
Each tag becomes one service file: `resources/<tag>.api.ts`.

Set `groupBy: 'path'` to group by the first path segment instead.
For example, `/users/{id}` and `/users` are grouped into `resources/users.api.ts`.

### Preserving output

Set `clean: false` to preserve existing files in the output directory:

```ts
export default defineConfig({
  input: './openapi.json',
  output: './src/generated/api',
  clean: false,
});
```

---

## Current Scope

For the full list of planned features and milestones, see the [Roadmap](./ROADMAP.md).  
For release notes and version history, see the [Changelog](./CHANGELOG.md).

## Design Philosophy

`ng-openapi-signals` follows a simple design:

```text
GET endpoints
→ Angular resource() + fetch()

POST / PUT / PATCH / DELETE endpoints
→ Promise-based fetch() methods
```

The goal is to generate Angular code that feels natural in modern signal-based applications while keeping the runtime small and easy to understand.

## Generated Code

Generated files include this header:

```ts
// Auto-generated by ng-openapi-signals.
// Do not edit manually.
```

Do not manually edit generated files.
Change your OpenAPI specification or generator configuration instead.

## License

MIT
