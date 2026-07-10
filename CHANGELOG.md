# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-07-10

### Added

- **Advanced query parameter serialization**: OpenAPI parameter `style` and `explode` are now supported for query parameters. The generated code wraps non-default style params with metadata (`{ value, style, explode }`) and the runtime `buildUrl` serializes them according to the OpenAPI specification. Supported styles: `form` (default), `spaceDelimited`, `pipeDelimited`, `deepObject`, with `explode: true/false` variants.
- **Header parameter support**: OpenAPI parameters with `in: header` are now generated as method arguments and merged into the request `headers` object. Header names with hyphens (e.g. `X-Request-Id`) are properly quoted in TypeScript property names and use bracket notation for access.
- **Multipart form data support**: Request bodies with `multipart/form-data` content type are now supported. The generator emits `formData: body` instead of `body:`, and the runtime builds a `FormData` object from the typed input. `Blob` values (binary parts) are appended directly without JSON serialization. The browser sets the `Content-Type` with the multipart boundary automatically.
- **`application/x-www-form-urlencoded` support**: Request bodies with `application/x-www-form-urlencoded` content type are serialized as `URLSearchParams` by the runtime.
- **File upload support**: Binary request body parts (`format: binary`) are typed as `Blob` and passed through without JSON serialization. Custom content types (e.g. `application/octet-stream`) are supported via the `contentType` field in `ApiRequestOptions`.
- **File download and stream support**: `text/event-stream` responses now map to `responseType: 'stream'`. The fetch transport returns `response.body` (`ReadableStream`); the httpClient transport maps `'stream'` to `'blob'` (Angular `HttpClient` has no native stream — call `.stream()` on the returned `Blob`).
- **Custom content types**: The generator emits a `contentType` field in `ApiRequestOptions` for non-JSON request bodies. The runtime uses this to set the `Content-Type` header and skips `JSON.stringify` for `FormData`, `Blob`, `ArrayBuffer`, and `URLSearchParams` bodies.
- **`RequestBodyModel` and `MultipartPartModel` types**: New types in `codegen/types.ts` capture request body content type, multipart metadata, and part schemas.
- **`QueryStyle` type**: New type in `codegen/types.ts` for OpenAPI parameter serialization styles.
- **`QueryParamOptions` interface**: Generated runtime interface for wrapping query param values with style/explode metadata.
- **Config options**: `RuntimeConfig` extended with `defaultQueryStyle` (default `'form'`), `defaultQueryExplode` (default `true`), and `preferContentType` (default `'application/json'`).
- **CLI flags**: `--default-query-style`, `--default-query-explode`, `--prefer-content-type` added to the CLI.
- **`isQueryStyle` type guard**: Exported from `config.ts` for validating the `defaultQueryStyle` option.
- **Test fixtures**: Added `tests/fixtures/query-styles.yml`, `tests/fixtures/multipart-upload.yml`, `tests/fixtures/header-params.yml`, `tests/fixtures/stream-download.yml`.
- **Tests**: Added `tests/query-styles.test.ts`, `tests/multipart.test.ts`, `tests/header-params.test.ts`, `tests/stream-download.test.ts`. Extended `tests/api-fetch-client.test.ts` and `tests/api-http-client.test.ts` with query style serialization, FormData/Blob body handling, and stream response tests. Extended `tests/config.test.ts` with new runtime config tests and `isQueryStyle` guard.
- **Example endpoints**: Added `searchUsersByTags` (spaceDelimited query + header param), `uploadUserAvatar` (multipart upload), `getUserEvents` (SSE stream) to `examples/openapi.json` and `examples/openapi.yml`.

### Changed

- `ParameterModel.location` type extended from `'path' | 'query'` to `'path' | 'query' | 'header'`. Cookie parameters are intentionally not supported.
- `ParameterModel` now includes optional `style` and `explode` fields.
- `OperationModel` now includes `headerParams`, `requestBody` (`RequestBodyModel`), and `responseParser` supports `'stream'`. The `requestBodyType` field is kept for backward compatibility.
- `extractRequestBody` replaces `extractRequestBodyType` in `generate-api.ts`, returning a `RequestBodyModel` with content type and multipart metadata.
- `toParameterModel` in `generate-api.ts` now parses `style` and `explode` from the OpenAPI parameter object.
- `generateQueryExpression` wraps non-default style params with `{ value, style, explode }` metadata; default style params remain plain values for backward compatibility.
- `generateMutationMethod` emits `formData: body` and `contentType:` for multipart/formUrlencoded request bodies.
- `generateResourceMethod` and `generateMutationMethod` now include header parameters in the params type and generate a `headers` object expression.
- `parserForContentType` in `generate-api.ts` now checks `text/event-stream` before the `text/` prefix to map to `'stream'`.
- `ApiRequestOptions` (both transports) extended with `formData`, `contentType`, and `'stream'` responseType.
- `buildUrl` (both `ApiFetchClient` and `ApiHttpClient`) rewritten to support OpenAPI style/explode serialization via `appendQueryParam` method.
- `ApiFetchClient.request` and `ApiHttpClient.request` now use `prepareBody` to handle `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams`, and custom content types.
- `ApiHttpClient.mapResponseType` now maps `'stream'` to `'blob'`.
- `DEFAULT_RUNTIME_CONFIG` extended with `defaultQueryStyle`, `defaultQueryExplode`, `preferContentType`.
- `mergeRuntime` and `validateConfig` in `config.ts` handle the new runtime config fields.

### Backwards Compatibility

- Without any new configuration, the generated runtime behaves identically to 0.6.x: query params use default `form` + `explode: true` (plain values, no metadata wrapper), request bodies are JSON-serialized with `Content-Type: application/json`, and no `formData`/`contentType` fields are emitted.
- Existing OpenAPI specs without `style`/`explode` on parameters, without `multipart/form-data` request bodies, and without header parameters produce identical generated output.
- The `requestBodyType` field on `OperationModel` is kept for backward compatibility (delegates to `requestBody.type`).
- The runtime codegen refactor is internal only — no generated output, CLI, or config changes.

### Fixed

- **Header params in mutation methods**: `generateHeaderExpression` now wraps header param values with `readSignalOrValue()` for mutation methods (POST/PUT/PATCH/DELETE). Header values passed as signals are unwrapped before being merged into the request `headers` object. GET resource methods remain unchanged (header values are already resolved in the `paramsFactory`).
- **Deprecated `statusText` in httpClient transport**: `toApiErrorFromHttpErrorResponse` no longer reads the deprecated `HttpErrorResponse.statusText` property, which Angular marks as `@deprecated` because it incorrectly remains `'OK'` with HTTP/2+. The generated `ApiError.statusText` is now set to an empty string for the `httpClient` transport; the reliable `status` (numeric status code) is preserved. The `fetch` transport is unaffected.
- **`onResponse` hook fired on error responses (fetch transport)**: The fetch transport `ApiFetchClient.request` invoked the `onResponse` hook before checking `response.ok`, causing the hook to fire on 4xx/5xx error responses. The documentation states the hook is "called after a successful response is received." The check order has been corrected: `!response.ok` is now evaluated first, and `onResponse` is only called for successful responses. The `httpClient` transport was already correct.
- **Wasted `FormData` construction in `prepareBody` (fetch transport)**: The fetch transport `prepareBody` always built a `FormData` object from `options.formData` before checking whether the content type was `application/x-www-form-urlencoded`. When the content type was form-urlencoded, the `FormData` was discarded and replaced with `URLSearchParams`. The content-type check now happens first, matching the `httpClient` transport and avoiding the wasted allocation.
- **Test fidelity gap for `stripUndefinedHeaders`**: The `api-fetch-client.test.ts` test helpers typed `headers` as `Record<string, string>` and spread values directly, while the generated runtime uses `Record<string, string | undefined>` with a `stripUndefinedHeaders` helper. The test helpers now mirror the runtime logic, ensuring optional header parameters that resolve to `undefined` are properly stripped.

## [0.6.2] - 2026-07-06

### Changed

- **`provideHttpClient()` no longer auto-included**: `provideNgOpenapiSignals()` no longer automatically includes `provideHttpClient()` when the `httpClient` transport is selected. Users must register `provideHttpClient()` themselves (e.g. `provideHttpClient(withInterceptors([...]))`) so they keep full control over interceptors and their order.

## [0.6.1] - 2026-07-06

### Fixed

- **`ApiHttpClient` type safety**: The `HttpClient.request` call in the generated httpClient transport now uses separate branches for each `responseType` (`'json'`, `'text'`, `'blob'`, `'arraybuffer'`) instead of a single call with a union type or `as any` cast. This resolves TypeScript overload errors caused by Angular's per-`responseType` overloads and preserves full type safety.

## [0.6.0] - 2026-07-06

### Added

- **HttpClient runtime transport**: An optional `httpClient` transport can be selected via `runtime.transport: 'httpClient'` in the config file or `--transport httpClient` on the CLI. When selected, the generator emits `ApiHttpClient` (wrapping Angular `HttpClient`) instead of `ApiFetchClient` (wrapping native `fetch()`). The `fetch` transport remains the default, preserving the zero-`HttpClient` guarantee.
- **`ApiHttpClient` service**: Generated `@Service()` class that wraps Angular `HttpClient`, injects the same DI tokens (`NG_OPENAPI_SIGNALS_BASE_PATH`, `NG_OPENAPI_SIGNALS_AUTH`, `NG_OPENAPI_SIGNALS_DEFAULT_HEADERS`, `NG_OPENAPI_SIGNALS_ERROR_MAPPER`, `NG_OPENAPI_SIGNALS_REQUEST_HOOK`, `NG_OPENAPI_SIGNALS_RESPONSE_HOOK`), and returns Promises via `firstValueFrom`.
- **`toApiErrorFromHttpErrorResponse`**: Generated error mapper for the httpClient transport that converts `HttpErrorResponse` to the shared `ApiError` interface.
- **`--transport` CLI flag**: New CLI option to select the HTTP transport (`fetch` or `httpClient`).
- **`isTransport` type guard**: Exported from `config.ts` for validating the `transport` option.
- **`HttpTransport` type**: Exported from `codegen/types.ts`.
- **Tests**: Added `tests/api-http-client.test.ts` with full runtime unit tests for the httpClient transport. Added transport coverage to `config.test.ts`, `generate.test.ts`, and `generated-api.test.ts`.

### Changed

- `RuntimeConfig` now includes a `transport` field (default `'fetch'`).
- `generateRuntimeFiles` branches on `transport` to emit either `api-fetch-client.ts` or `api-http-client.ts`.
- `generateApiError` branches on `transport` to emit either `toApiError` (fetch) or `toApiErrorFromHttpErrorResponse` (httpClient).
- `generateProviders` branches on `transport`: the httpClient variant omits `NG_OPENAPI_SIGNALS_MIDDLEWARE` and does not include `provideHttpClient()` (users register it themselves).
- `generateService` branches on `transport` to import and inject `ApiHttpClient` or `ApiFetchClient`.
- `generateIndexFile` branches on `transport` to export `./api-http-client` or `./api-fetch-client`.
- `mergeRuntime` and `validateConfig` now handle the `transport` field.

### Backwards Compatibility

- Without any new configuration, the generated runtime behaves identically to 0.5.x: `transport` defaults to `'fetch'`, `ApiFetchClient` is generated, and no `HttpClient` dependency is introduced.
- Existing tests continue to pass without modification.

### Migration

- To switch to the `httpClient` transport, set `runtime.transport: 'httpClient'` in your config file or pass `--transport httpClient` on the CLI.
- The httpClient transport uses Angular `HttpInterceptors` instead of fetch middleware. Configure interceptors via `provideHttpClient(withInterceptors([...]))`.
- The `NG_OPENAPI_SIGNALS_MIDDLEWARE` token is not emitted for the httpClient transport.

## [0.5.0] - 2026-07-05

### Added

- **Fetch middleware**: Onion-style middleware functions `(request, next) => Promise<Response>` can be registered via `provideNgOpenapiSignals({ middleware })`. Middleware can mutate requests, short-circuit, transform responses, or handle errors. Configured through the `NG_OPENAPI_SIGNALS_MIDDLEWARE` DI token.
- **Auth header hooks**: An optional `auth` hook (`() => Record<string, string> | Promise<...>`) merges auth headers into every request. Configured through the `NG_OPENAPI_SIGNALS_AUTH` DI token.
- **Custom default headers**: Static default headers can be set via `runtime.defaultHeaders` in the config file (baked into the `provideNgOpenapiSignals` defaults) and/or overridden at runtime via `provideNgOpenapiSignals({ defaultHeaders })`. Configured through the `NG_OPENAPI_SIGNALS_DEFAULT_HEADERS` DI token.
- **Custom error mapping**: A custom error mapper can replace the default `toApiError` via `provideNgOpenapiSignals({ errorMapper })`. Configured through the `NG_OPENAPI_SIGNALS_ERROR_MAPPER` DI token.
- **Request and response hooks**: `onRequest` and `onResponse` hooks allow pre/post-fetch interception. Configured through the `NG_OPENAPI_SIGNALS_REQUEST_HOOK` and `NG_OPENAPI_SIGNALS_RESPONSE_HOOK` DI tokens.
- **Non-JSON response parsing**: The generated `ApiFetchClient` now parses responses based on a spec-driven `responseType` hint (`'json' | 'text' | 'blob' | 'arrayBuffer'`) derived from the OpenAPI response `content` type, with content-type sniffing as a fallback.
- **`Blob`, `ArrayBuffer` and plain text responses**: OpenAPI `format: binary` schemas now map to `Blob`. Text content types map to `string`. Binary content types map to `Blob`. The runtime supports `responseType: 'arrayBuffer'` for explicit ArrayBuffer parsing.
- **`runtime` config section**: New `RuntimeConfig` (`defaultHeaders`, `responseTypeHints`) added to `GeneratorConfig` with deep-merge in `resolveConfig` and validation in `validateConfig`.
- **Fixture-based tests**: Added `tests/fixtures/response-types.yml` with a dedicated test suite for response type hints (json, text, blob, 204).

### Changed

- The generated `ApiFetchClient.request<T>` method has been refactored from a monolithic implementation into a middleware pipeline. Without middleware/hooks configured, behavior is backwards-compatible with 0.4.x.
- `extractResponseType` in `generate-api.ts` now returns both the TypeScript type and a `responseParser` hint derived from the success response content type.
- `extractSchemaFromResponse` in `generate-api.ts` now returns the content type alongside the schema.
- `schemaToTsType` now maps `format: binary` to `Blob` instead of `string`.
- Generated API methods now emit a `responseType` field in `ApiRequestOptions` when `runtime.responseTypeHints` is `true` (default).
- The generated `providers.ts` now defines six new DI tokens and the `provideNgOpenapiSignals` signature accepts the new optional options.

### Backwards Compatibility

- Without any new configuration, the generated runtime behaves identically to 0.4.x: no middleware, no auth hook, empty default headers, `toApiError` as the error mapper, and content-type sniffing for response parsing.
- Existing tests continue to pass without modification (except one assertion in `generate.test.ts` updated for the new multi-line import in `api-fetch-client.ts`).

## [0.4.0] - 2026-07-05

### Added

- **Enum generation**: Enum schemas in `components/schemas` are now extracted as named union types (`export type UserStatus = 'active' | 'invited' | 'disabled';`) with their own model files and barrel exports, instead of being inlined everywhere.
- **Nullable handling**: OpenAPI 3.0 `nullable: true` is now supported in addition to OpenAPI 3.1 `type: [x, 'null']`. Nullable properties, arrays, `$ref`s, and primitives correctly produce `T | null`.
- **Object schema composition**: `allOf` (intersection `A & B`), `oneOf`/`anyOf` (union `A | B`) are now supported in `schemaToTsType`. Composition-only schemas in `components/schemas` become type aliases.
- **Inline schema hoisting**: Anonymous inline object schemas in properties, request bodies, responses, and parameters are now automatically named (e.g. `UserAddress` from `User.address`) and hoisted to `components/schemas` before generation, producing named model files instead of `Record<string, unknown>`.
- **Record type generation**: `additionalProperties` with a typed schema now produces `Record<string, T>` instead of `Record<string, unknown>`. `additionalProperties: true` still produces `Record<string, unknown>`.
- **Tuple support**: OpenAPI 3.1 `prefixItems` produces TypeScript tuple types (`[A, B, C]`).
- **Fallback `operationId`**: Operations without `operationId` now get camelCase names derived from the HTTP method and path (e.g. `GET /users/{id}` → `getUsersById`, `POST /users` → `createUsers`), using the existing `camelCase`/`pascalCase` helpers from `naming.ts`.
- **Success response status codes**: All 2xx response codes (including OpenAPI 3.1 `2XX` ranges) are now collected and unioned (`Foo | Bar`). The dangerous fallback to `Object.values(responses)[0]` (which could pick an error response) has been removed. Content-type detection now accepts any JSON-like content type, not just `application/json`.
- **Fixture-based tests**: Added per-feature OpenAPI fixture specs under `tests/fixtures/` with dedicated test suites for enums, nullable, composition, records, inline schemas, tuples, fallback operationId, and status codes.

### Changed

- `extractSchemas` in `generate-models.ts` now dispatches on schema shape (enum / object / composition / primitive alias) instead of always generating an interface. Enum-only and primitive schemas no longer produce empty interfaces.
- `collectType` in both `generate-models.ts` and `generate-api.ts` now recognizes `Record<string, X>`, intersection types (`A & B`), tuple types (`[A, B]`), and inline object literals for import collection.
- `schemaToTsType` now handles `allOf`/`oneOf`/`anyOf`, `additionalProperties` (typed records), `prefixItems` (tuples), and inline object type literals as a fallback when hoisting is not applicable.

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
