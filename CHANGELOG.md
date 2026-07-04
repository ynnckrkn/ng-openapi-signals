# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-07-04

### Fixed

- Fixed missing model type references in generated API methods by switching from `SwaggerParser.dereference` to `SwaggerParser.bundle`, preserving `$ref` pointers so response and request body types resolve to model names (e.g. `User`) instead of `Record<string, unknown>`.
- Removed unnecessary `params: void` arguments from generated mutation methods when an operation has no path or query parameters.
- Removed `as any` casts from generated `readSignalOrValue` calls.
- Removed blank-line artifacts in generated request option objects from conditional template strings.
- Replaced unsafe `undefined as T` casts with `undefined as unknown as T` in `ApiFetchClient` for 204 and non-JSON responses.

### Changed

- Generated Angular service imports are now conditional: `resource`, `MaybeSignal` and `readSignalOrValue` are only imported when actually used.
- Generated model files now import referenced model types from `./index` when they have cross-model references.
- Empty model import lines are no longer emitted in generated API files.

### Added

- Added `tsconfig.test.json` for type-checking test files with Node and Vitest globals.
- Added generator tests verifying file output and auto-generated header.
- Added generated API tests verifying model imports, response types, method signatures and absence of `params: void` and `as any`.
- Added generated model tests verifying interface properties and re-exports.
- Added error-handling tests for `toApiError` with JSON, text, empty and missing content-type bodies.
- Added `ApiFetchClient` request logic tests for URL building, query params, 204 handling, error throwing and Content-Type headers.
- Added GitHub Actions CI workflow with lint, build, test and generated-output checks.

## [0.1.1] - 2026-07-04

### Changed

- Changed generated Angular services from `Injectable(...)` output to `Service()` output.
- Disabled declaration file generation in `tsup.config`.
- Updated README documentation.

### Added

- Added ESLint configuration.
- Added Prettier configuration.
- Added `.npmignore`.
- Added `CHANGELOG.md` to published package files.

### Chore

- Removed TypeScript 6 deprecation ignore workaround.

## [0.1.0] - 2026-07-04

### Added

- Initial MVP of `ng-openapi-signals`.
- CLI command `ng-openapi-signals generate`.
- OpenAPI 3.x JSON/YAML input.
- TypeScript model generation.
- GET endpoints as Angular `resource()` APIs.
- POST, PUT, PATCH and DELETE endpoints as Promise-based `fetch()` methods.
- Generated `ApiFetchClient`.
- Generated `API_BASE_URL` injection token.
- Support for path and query parameters.
- Support for JSON request bodies and JSON responses.
- Example OpenAPI specification under `examples/openapi.json`.
