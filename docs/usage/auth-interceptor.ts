// Example: auth headers and fetch middleware via provideNgOpenapiSignals().
//
// The runtime extension points (auth, middleware, hooks) are configured at
// runtime through Angular DI. Static defaults live in the config file;
// dynamic values (e.g. a bearer token from a signal) are provided here.
//
// Middleware can be registered in two ways:
//  1. Convenience array — `provideNgOpenapiSignals({ middleware: [...] })`
//     (function-based only, flattened into multi-providers).
//  2. Class-based via DI — `{ provide: NG_OPENAPI_SIGNALS_MIDDLEWARE,
//     multi: true, useClass: … }`. Class middleware can inject services via
//     constructor DI and can be registered from any feature module.
//
// Adjust the import path to point at your generated client directory.

import {ApplicationConfig, Injectable, inject} from '@angular/core';
import {
  provideNgOpenapiSignals,
  ApiRequestContext,
  ApiMiddleware,
  NG_OPENAPI_SIGNALS_MIDDLEWARE,
} from '../../examples/generated/api';

// In a real app this would come from an auth service or signal.
function getAuthToken(): string {
  return 'my-token';
}

// ---------------------------------------------------------------------------
// Class-based middleware with constructor DI.
//
// Implement the `ApiMiddleware` interface and decorate with `@Injectable()`.
// Register it via `{ provide: NG_OPENAPI_SIGNALS_MIDDLEWARE, multi: true,
// useClass: AuthRefreshMiddleware }` — the runtime dispatches via duck-typing
// (`typeof mw === 'function'`): functions are called directly, objects have
// their `handle()` method invoked.
// ---------------------------------------------------------------------------

@Injectable()
class AuthRefreshMiddleware implements ApiMiddleware {
  // Inject any service you need — AuthService, Router, MessageService, …
  // private readonly auth = inject(AuthService);

  async handle(req: ApiRequestContext, next: () => Promise<Response>): Promise<Response> {
    const res = await next();

    // If the access token expired, refresh it and retry once.
    if (res.status === 401) {
      // await this.auth.refreshToken();
      // req.init.headers = { ...req.init.headers, Authorization: `Bearer ${this.auth.token()}` };
      return next();
    }

    return res;
  }
}

@Injectable()
class LoggingMiddleware implements ApiMiddleware {
  async handle(req: ApiRequestContext, next: () => Promise<Response>): Promise<Response> {
    console.log('→', req.init.method, req.url);
    const res = await next();
    console.log('←', res.status);
    return res;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgOpenapiSignals({
      basePath: 'https://api.example.com',

      // Called once per request to add auth headers.
      auth: () => ({
        Authorization: `Bearer ${getAuthToken()}`,
      }),

      // Static default headers merged into every request.
      defaultHeaders: {
        'X-Client': 'my-app',
      },

      // Function-based middleware via the convenience array.
      // Entries are flattened into the same multi-provider stream as the
      // class-based providers below, preserving registration order.
      middleware: [
        async (req: ApiRequestContext, next: () => Promise<Response>) => {
          console.log('→', req.init.method, req.url);
          const res = await next();
          console.log('←', res.status);
          return res;
        },
      ],

      // Called before the middleware pipeline runs. Can mutate the request.
      onRequest: (ctx: ApiRequestContext) => {
        ctx.init.headers = {
          ...ctx.init.headers,
          'X-Trace-Id': crypto.randomUUID(),
        };
      },

      // Called after a successful response is received.
      onResponse: (res: Response) => console.log('response', res.status),
    }),

    // Class-based middleware registered via DI. These can inject services
    // via constructor DI and can be declared in any feature module.
    {provide: NG_OPENAPI_SIGNALS_MIDDLEWARE, multi: true, useClass: LoggingMiddleware},
    {provide: NG_OPENAPI_SIGNALS_MIDDLEWARE, multi: true, useClass: AuthRefreshMiddleware},
  ],
};
