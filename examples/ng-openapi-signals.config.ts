import {defineConfig} from '../src/config';

export default defineConfig({
  input: 'examples/openapi.yml',
  output: 'examples/generated',
  clean: true,
  groupBy: 'tag',
  // Runtime options — all shown with their defaults. Omit the `runtime`
  // block entirely to keep the defaults; override only what you need.
  runtime: {
    // HTTP transport: 'fetch' (native fetch(), zero HttpClient) or
    // 'httpClient' (Angular HttpClient wrapper).
    transport: 'fetch',
    // Static default headers baked into every request.
    defaultHeaders: {},
    // Emit spec-driven responseType hints ('json' | 'text' | 'blob' | ...).
    // Set to false to rely on runtime content-type sniffing only.
    responseTypeHints: true,
    // Default query parameter serialization style when the OpenAPI spec
    // does not specify `style`.
    defaultQueryStyle: 'form',
    // Default `explode` flag for query parameters when the OpenAPI spec
    // does not specify `explode`.
    defaultQueryExplode: true,
    // Preferred content type when a request body offers multiple media types.
    preferContentType: 'application/json',
    // Generate additional signal-based `${operationId}Mutation()` methods
    // for POST/PUT/PATCH/DELETE, returning a `Mutation` with
    // `result`/`error`/`status`/`isLoading` signals and `mutate()`/`reset()`.
    // Existing Promise-based methods remain (strictly additive).
    signalMutations: true,
    // Convert ISO-8601 date strings in JSON responses to Date objects.
    dateTransformer: true,
  },
});