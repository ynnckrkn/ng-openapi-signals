// Example: auth headers and fetch middleware via provideNgOpenapiSignals().
//
// The runtime extension points (auth, middleware, hooks) are configured at
// runtime through Angular DI. Static defaults live in the config file;
// dynamic values (e.g. a bearer token from a signal) are provided here.
//
// Adjust the import path to point at your generated client directory.

import {ApplicationConfig} from '@angular/core';
import {provideNgOpenapiSignals, ApiRequestContext} from '../generated/api';

// In a real app this would come from an auth service or signal.
function getAuthToken(): string {
  return 'my-token';
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

      // Onion-style fetch middleware: (request, next) => response.
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
  ],
};
