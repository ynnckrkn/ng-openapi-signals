// Example: GET endpoint with resource() and signals.
//
// Generated GET endpoints become Angular `resource()` APIs that accept
// plain values or signals. The resource reloads whenever params change.
//
// Adjust the import path to point at your generated client directory.

import {Component, inject, signal} from '@angular/core';
import {UsersApi} from '../generated/api';

@Component({
  selector: 'app-user-detail',
  template: `
    @if (user.isLoading()) {
      <p>Loading…</p>
    }

    @if (user.error()) {
      <p>Something went wrong.</p>
    }

    @if (user.hasValue()) {
      <h1>{{ user.value().name }}</h1>
    }
  `,
})
export class UserDetailComponent {
  private readonly usersApi = inject(UsersApi);

  // Pass a signal — the resource reloads when the signal changes.
  readonly userId = signal('123');

  readonly user = this.usersApi.getUserByIdResource({
    id: this.userId,
  });
}
