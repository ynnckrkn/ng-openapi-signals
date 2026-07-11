// Example: mutating endpoints (POST / PUT / PATCH / DELETE) as Promises.
//
// Mutating endpoints are generated as Promise-based methods using fetch().
// They are explicit and predictable — call them from event handlers or
// effects.
//
// Adjust the import path to point at your generated client directory.

import {Component, inject} from '@angular/core';
import {UsersApi} from '../generated/api';

@Component({
  selector: 'app-create-user',
  template: `
    <button (click)="create()" [disabled]="busy">
      {{ busy ? 'Creating…' : 'Create user' }}
    </button>
  `,
})
export class CreateUserComponent {
  private readonly usersApi = inject(UsersApi);

  busy = false;

  async create(): Promise<void> {
    this.busy = true;

    try {
      const user = await this.usersApi.createUser({
        name: 'John Doe',
        email: 'john@example.com',
      });

      console.log('Created user', user);
    } catch (error) {
      console.error('Failed to create user', error);
    } finally {
      this.busy = false;
    }
  }
}