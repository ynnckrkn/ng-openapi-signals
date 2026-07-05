# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-05

### Changed

- Switched generated base URL configuration to the provider-based helper `provideNgOpenapiSignals({ basePath })`.

### BREAKING CHANGE

- The generated `API_BASE_URL` token approach has been replaced.
- Consumers must now register the base URL via `provideNgOpenapiSignals({ basePath: 'https://...' })` instead of providing `API_BASE_URL` manually.
- The `apiBaseUrlToken` config option and the `--api-base-url-token` CLI flag have been removed.

## [0.2.2] - 2026-07-05

### Fixed

- Reduced published package size by moving `prettier` from `devDependencies` to `dependencies`, so tsup externalizes it instead of bundling Prettier and all its parsers/plugins into `dist/`.
- Disabled source maps in the tsup build (`sourcemap: false`) to keep `*.js.map` files out of the published `dist/` bundle.

## [0.2.1] - 2026-07-04

### Fixed

- Fixed missing TypeScript declaration files (`.d.ts`) for the `ng-openapi-signals/config` export by enabling `dts` generation in tsup. Consumers no longer get "implicitly has an 'any' type" errors when importing the config module.
- Added `tsconfig.dts.json` to isolate the `ignoreDeprecations: "6.0"` workaround needed for tsup's internal DTS build under TypeScript 6, keeping the main `tsconfig.json` clean.

## [0.2.0] - 2026-07-04

### Added

- Added config file support via `ng-openapi-signals.config.ts` with `defineConfig()` helper.
- Added `--config <path>` CLI flag to specify a custom config file path.
- Added `--clean` / `--no-clean` CLI flags to control output directory cleaning.
- Added `--api-base-url-token <name>` CLI flag to customize the generated `InjectionToken` name.
- Added `--group-by <tag|path>` CLI flag to group generated APIs by tag or path segment.
- Added `jiti` as a runtime dependency for loading TypeScript config files.
- Added config tests covering loading, merging, validation, and defaults.
- Added generate tests for `clean: false`, custom token names, and path-based grouping.
- Added "Configuration" section to README with environment integration examples.

### Changed

- CLI flags `-i/--input` and `-o/--output` are now optional (can be provided via config file).
- CLI flags override config file values; config file values override defaults.
- `generate()` now accepts a `GeneratorConfig` object instead of `GenerateOptions`.
- `generateRuntimeFiles()` and `generateApiFiles()` now accept a `GeneratorConfig` parameter.
- The `API_BASE_URL` token name is now configurable via `config.apiBaseUrlToken`.
- API grouping can now be switched between tag-based and path-based via `config.groupBy`.
- Updated Angular Setup and `API_BASE_URL` documentation to reference environment files.
- Updated CLI options table in README with all new flags.
- Bumped CLI version to `0.2.0`.

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
