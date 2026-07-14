// Example: signal-based mutation for POST/PUT/PATCH/DELETE endpoints.
//
// When `runtime.signalMutations` is enabled in the config, the generator
// emits an additional `${operationId}Mutation()` method for every mutating
// endpoint, alongside the existing Promise-based method. The mutation
// method returns a `Mutation` object exposing reactive signals:
//
//   - `result`    — the last successful response value (or `undefined`).
//   - `error`     — the last thrown error (or `undefined`).
//   - `status`    — `'idle' | 'loading' | 'success' | 'error'`.
//   - `isLoading` — `computed(() => status() === 'loading')`.
//   - `mutate(body, signal?)` — triggers the request, returns a Promise.
//   - `reset()`   — clears `result`/`error` and returns to `'idle'`.
//
// This example mirrors `mutation-usage.ts` but uses the signal-based API so
// the template reacts to loading/error/success states automatically without
// manual `busy` flags.
//
// Enable the feature in your config:
//
//   export default defineConfig({
//     ...
//     runtime: { signalMutations: true },
//   });
//
// or via the CLI: `ng-openapi-signals generate --signal-mutations`.
//
// Adjust the import path to point at your generated client directory.

import {Component, computed, inject} from '@angular/core';
import {UsersApi} from '../generated/api';

@Component({
  selector: 'app-create-user',
  template: `
    <button (click)="create()" [disabled]="creating.isLoading()">
      {{ creating.isLoading() ? 'Creating…' : 'Create user' }}
    </button>

    @if (creating.error()) {
      <p class="error">Failed to create user.</p>
    }

    @if (creating.result(); as user) {
      <p>Created user: {{ user.name }} ({{ user.email }})</p>
    }
  `,
})
export class CreateUserComponent {
  private readonly usersApi = inject(UsersApi);

  // Signal-based mutation — no manual `busy` flag required.
  readonly creating = this.usersApi.createUserMutation();

  // Derived state is recomputed automatically when the mutation's signals change.
  readonly hasResult = computed(() => this.creating.result() !== undefined);

  create(): void {
    // `mutate()` returns a Promise so you can `await` it if needed, but the
    // reactive signals update regardless of whether you await.
    this.creating.mutate({
      name: 'John Doe',
      email: 'john@example.com',
    });
  }
}