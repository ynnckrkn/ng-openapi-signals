/**
 * Date Transformer usage example.
 *
 * Requires `runtime.dateTransformer: true` in ng-openapi-signals.config.ts
 * (or `--date-transformer` CLI flag). When enabled, the generator emits a
 * `date-utils.ts` runtime file and wires `transformDates()` into the JSON
 * parsing path. ISO-8601 date-time strings in JSON response bodies are
 * automatically converted to `Date` instances — no runtime setup needed.
 *
 * This file is illustrative only — adjust the import paths to your generated
 * client directory. It is not included in the npm package.
 */

import {Component, computed, inject} from '@angular/core';
import {UsersApi} from './generated/resources/users.api';

@Component({
  selector: 'app-user-profile',
  template: `
    @if (userResource.isLoading()) {
      <p>Loading…</p>
    } @else if (userResource.value()) {
      <p>{{ user()?.name }}</p>
      <!-- createdAt is a Date instance, not a string -->
      <p>Joined: {{ user()?.createdAt?.toLocaleDateString() }}</p>
    }
  `,
})
export class UserProfile {
  private readonly usersApi = inject(UsersApi);

  // The response body is transformed automatically: any ISO-8601 date-time
  // string (e.g. "2026-07-15T12:00:00Z") becomes a Date instance.
  // Works with both `fetch` and `httpClient` transports.
  userResource = this.usersApi.getUserByIdResource({id: '123'});

  user = computed(() => this.userResource.value());
}