// Example: httpClient transport setup.
//
// When `transport: 'httpClient'` is selected, the generator emits
// `ApiHttpClient` instead of `ApiFetchClient`. It wraps Angular `HttpClient`
// so you can integrate with `HttpInterceptors`.
//
// `provideNgOpenapiSignals()` does NOT include `provideHttpClient()` —
// register it yourself so you keep full control over interceptors and
// their order.
//
// Adjust the import path to point at your generated client directory.

import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors, HttpInterceptorFn} from '@angular/common/http';
import {provideNgOpenapiSignals} from '../generated/api';

// A custom interceptor example (implement as needed).
const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('→', req.method, req.url);
  return next(req);
};

export const appConfig: ApplicationConfig = {
  providers: [
    // Register HttpClient yourself when using the httpClient transport.
    provideHttpClient(withInterceptors([loggingInterceptor])),

    provideNgOpenapiSignals({
      basePath: 'https://api.example.com',
    }),
  ],
};