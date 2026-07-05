# Roadmap

This roadmap outlines the planned direction for `ng-openapi-signals`.

## 0.1.x - MVP Stabilization

- [x] Improve generated method signatures.
- [x] Remove unnecessary `params: void` arguments.
- [x] Add tests for the example OpenAPI specification.
- [x] Improve TypeScript strict-mode compatibility.
- [x] Improve generated imports.
- [x] Add basic error handling tests.
- [x] Add GitHub Actions for build and test checks.

## 0.2.x - Configuration

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

## 0.4.x - Better OpenAPI Support

- [x] Improve enum generation.
- [x] Improve nullable type handling.
- [x] Improve object schema generation.
- [x] Add support for inline schemas.
- [x] Improve array and record type generation.
- [x] Improve fallback names for missing `operationId`.
- [x] Add support for more success response status codes.

## 0.5.x - Fetch Runtime Improvements

- [x] Add fetch middleware support.
- [x] Add auth header hooks.
- [x] Add custom default headers.
- [x] Add custom error mapping.
- [x] Add request and response hooks.
- [x] Add better handling for non-JSON responses.
- [x] Add support for `Blob`, `ArrayBuffer` and plain text responses.

## 0.6.x - Advanced Request Support

- Add advanced query parameter serialization.
- Support OpenAPI parameter styles.
- Add multipart form data support.
- Add file upload support.
- Add file download support.
- Add support for custom content types.

## 0.7.x - Developer Experience

- Add better CLI output.
- Add `--watch` mode.
- Add `--dry-run` mode.
- Add `--check` mode for CI.
- Improve error messages.
- Add more example projects.
- Add Angular example app.

## 0.8.x - Testing and Quality

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
