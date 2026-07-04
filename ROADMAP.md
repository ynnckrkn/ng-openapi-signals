# Roadmap

This roadmap outlines the planned direction for `ng-openapi-signals`.

## 0.1.x - MVP Stabilization

- Improve generated method signatures.
- Remove unnecessary `params: void` arguments.
- Add tests for the example OpenAPI specification.
- Improve TypeScript strict-mode compatibility.
- Improve generated imports.
- Add basic error handling tests.
- Add GitHub Actions for build and test checks.

## 0.2.x - Configuration

- Add config file support.
- Support `ng-openapi-signals.config.ts`.
- Add options for input and output paths.
- Add option to clean or preserve the output directory.
- Add option to customize the API base URL token name.
- Add option to group generated APIs by tags or paths.

## 0.3.x - Better OpenAPI Support

- Improve enum generation.
- Improve nullable type handling.
- Improve object schema generation.
- Add support for inline schemas.
- Improve array and record type generation.
- Improve fallback names for missing `operationId`.
- Add support for more success response status codes.

## 0.4.x - Fetch Runtime Improvements

- Add fetch middleware support.
- Add auth header hooks.
- Add custom default headers.
- Add custom error mapping.
- Add request and response hooks.
- Add better handling for non-JSON responses.
- Add support for `Blob`, `ArrayBuffer` and plain text responses.

## 0.5.x - Advanced Request Support

- Add advanced query parameter serialization.
- Support OpenAPI parameter styles.
- Add multipart form data support.
- Add file upload support.
- Add file download support.
- Add support for custom content types.

## 0.6.x - Developer Experience

- Add better CLI output.
- Add `--watch` mode.
- Add `--dry-run` mode.
- Add `--check` mode for CI.
- Improve error messages.
- Add more example projects.
- Add Angular example app.

## 0.7.x - Testing and Quality

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
