# Roadmap

This roadmap outlines the planned direction for `ng-openapi-signals`.

## 0.1.0 - MVP Stabilization

- [x] Improve generated method signatures.
- [x] Remove unnecessary `params: void` arguments.
- [x] Add tests for the example OpenAPI specification.
- [x] Improve TypeScript strict-mode compatibility.
- [x] Improve generated imports.
- [x] Add basic error handling tests.
- [x] Add GitHub Actions for build and test checks.

## 0.2.0 - Configuration

- [x] Add config file support.
- [x] Support `ng-openapi-signals.config.ts`.
- [x] Add options for input and output paths.
- [x] Add option to clean or preserve the output directory.
- [x] Add option to customize the API base URL token name.
- [x] Add option to group generated APIs by tags or paths.

## 0.3.0 - Provider-based Base URL Configuration

- [x] Introduce the generated `provideNgOpenapiSignals({ basePath })` helper as the default way to configure the API base URL.
- [x] Replace the old `API_BASE_URL` token-based setup in generated clients and examples.
- [x] Document the migration path for existing consumers.

## 0.4.0 - Better OpenAPI Support

- [x] Improve enum generation.
- [x] Improve nullable type handling.
- [x] Improve object schema generation.
- [x] Add support for inline schemas.
- [x] Improve array and record type generation.
- [x] Improve fallback names for missing `operationId`.
- [x] Add support for more success response status codes.

## 0.5.0 - Fetch Runtime Improvements

- [x] Add fetch middleware support.
- [x] Add auth header hooks.
- [x] Add custom default headers.
- [x] Add custom error mapping.
- [x] Add request and response hooks.
- [x] Add better handling for non-JSON responses.
- [x] Add support for `Blob`, `ArrayBuffer` and plain text responses.

## 0.6.0 - HttpClient Runtime Option

- [x] Add an optional `HttpClient`-based runtime as an alternative to the native `fetch()` runtime.
- [x] Add a config option to select the HTTP transport (`fetch` or `httpClient`).
- [x] Generate an `ApiHttpClient` that wraps Angular `HttpClient` instead of `fetch()`.
- [x] Map `resource()` loaders to `HttpClient` calls when the `httpClient` transport is selected.
- [x] Map mutation methods to `HttpClient` calls (returning Promises via `firstValueFrom`).
- [x] Keep the `fetch()` runtime as the default to preserve the zero-`HttpClient` guarantee.
- [x] Document the trade-offs and migration path between the `fetch` and `httpClient` transports.
- [x] Add tests covering both runtime transports.

## 0.7.x - Advanced Request Support

- [x] Add advanced query parameter serialization.
- [x] Support OpenAPI parameter styles.
- [x] Add multipart form data support.
- [x] Add file upload support.
- [x] Add file download support.
- [x] Add support for custom content types.

## 0.8.0 - Developer Experience

- [x] Add better CLI output.
- [x] Add `--dry-run` mode.
- [x] Add `--check` mode for CI.
- [x] Improve error messages.
- [x] Add more example code snippets.

## 0.8.x - Schema Transformation

- Add built-in transformers for dates.

## 0.9.x - Testing and Quality

- Add fixture-based generator tests.
- Add snapshot tests for generated output.
- Add runtime tests for `ApiFetchClient`.
- Add test coverage reporting.
- Add linting.
- Add release checks.

## 1.0.0 - Stable Release

- Stabilize generated API shape.
- Stabilize configuration format.
- Complete documentation.
- Add migration guide.
- Add changelog automation.
- Add npm release automation.
- Mark the project as production-ready.
