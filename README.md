# ng-openapi-signals

Signal-first OpenAPI client generator for Angular using `resource()` and `fetch()`.

`ng-openapi-signals` generates lightweight Angular API clients from OpenAPI specifications.
GET endpoints are generated as Angular `resource()` APIs, while mutating endpoints such as POST, PUT, PATCH and DELETE are generated as Promise-based `fetch()` methods.

## Features

- Generate Angular API clients from OpenAPI 3.x specifications
- Signal-first read APIs using Angular `resource()`
- Lightweight runtime based on native `fetch()`
- No dependency on Angular `HttpClient`
- Typed models generated from OpenAPI schemas
- Path parameter support
- Query parameter support
- JSON request body support
- JSON response handling
- Basic API error handling
- Base URL configuration via Angular `InjectionToken`

## Requirements

- Node.js 24 or newer
- Angular 22 or newer
- TypeScript
- OpenAPI 3.x JSON or YAML specification

## Installation

```bash
npm install -D ng-openapi-signals
```

Or run it directly with `npx`:

```bash
npx ng-openapi-signals generate --input openapi.json --output src/generated/api
```

## Quick Start

Given an OpenAPI file:

```text
openapi.json
```

Run:

```bash
npx ng-openapi-signals generate \
  --input ./openapi.json \
  --output ./src/generated/api
```

This generates an Angular API client in:

```text
src/generated/api
```

Example output:

```text
src/generated/api/
  api-error.ts
  api-fetch-client.ts
  signal-utils.ts
  tokens.ts
  index.ts
  models/
    user.ts
    create-user-request.ts
    index.ts
  resources/
    users.api.ts
    index.ts
```

## Angular Setup

Provide the API base URL in your Angular application config:

```ts
import { ApplicationConfig } from "@angular/core";
import { API_BASE_URL } from "./generated/api";

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: API_BASE_URL,
      useValue: "https://api.example.com",
    },
  ],
};
```

## Usage

Assume your OpenAPI specification contains this endpoint:

```text
GET /users/{id}
```

The generated API can be used like this:

```ts
import { Component, inject, signal } from "@angular/core";
import { UsersApi } from "./generated/api";

@Component({
  selector: "app-user-detail",
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

  readonly userId = signal("123");

  readonly user = this.usersApi.getUserByIdResource({
    id: this.userId,
  });
}
```

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
  name: "John Doe",
  email: "john@example.com",
});
```

This keeps read operations reactive while keeping write operations explicit and predictable.

## Runtime

The generated client includes a small runtime:

```text
api-fetch-client.ts
api-error.ts
signal-utils.ts
tokens.ts
```

### `ApiFetchClient`

The generated `ApiFetchClient` wraps native `fetch()` and handles:

- Base URL handling
- JSON request bodies
- JSON responses
- Query parameters
- Abort signals
- Basic error handling

### `API_BASE_URL`

The generated `API_BASE_URL` token is used to configure the base URL of your backend API.

```ts
import { API_BASE_URL } from "./generated/api";

providers: [
  {
    provide: API_BASE_URL,
    useValue: "https://api.example.com",
  },
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
  id: "123",
});
```

or:

```ts
api.getUserByIdResource({
  id: signal("123"),
});
```

## CLI

### Generate

```bash
ng-openapi-signals generate --input <openapi-file> --output <output-directory>
```

Example:

```bash
ng-openapi-signals generate \
  --input ./openapi.json \
  --output ./src/generated/api
```

### Options

| Option                | Description                                       |
| --------------------- | ------------------------------------------------- |
| `-i, --input <path>`  | Path to the OpenAPI JSON or YAML file             |
| `-o, --output <path>` | Output directory for the generated Angular client |

## Local Development

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ng-openapi-signals.git
cd ng-openapi-signals
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Generate the example client:

```bash
npm run generate:example
```

Run tests:

```bash
npm test
```

Format files:

```bash
npm run format
```

## Example

The repository contains an example OpenAPI specification:

```text
examples/openapi.json
```

Generate the example client:

```bash
npm run generate:example
```

The generated files will be written to:

```text
examples/generated
```

## Project Status

This project is currently in early development.

The first goal is to provide a small, focused OpenAPI generator for Angular applications that want to use signal-based APIs with `resource()` and native `fetch()`.

## Current Scope

Supported in the first MVP:

- OpenAPI 3.x input
- JSON and YAML specifications
- TypeScript model generation
- GET endpoints as `resource()` APIs
- POST, PUT, PATCH and DELETE endpoints as Promise methods
- Path parameters
- Query parameters
- JSON request bodies
- JSON responses
- Basic error handling

Not yet fully supported:

- Advanced OpenAPI parameter serialization styles
- Multipart form data
- File upload
- File download
- Authentication helpers
- Custom fetch interceptors
- Advanced `oneOf`, `anyOf` and discriminator handling
- Pagination helpers
- Angular schematics
- Nx plugin

## Roadmap

Planned improvements:

- Config file support
- Better enum generation
- Better nullable handling
- Better object schema generation
- Better generated method signatures
- Auth header hooks
- Custom fetch middleware
- File upload and download support
- More OpenAPI fixtures
- Vitest test suite
- GitHub Actions workflow
- npm release automation

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
