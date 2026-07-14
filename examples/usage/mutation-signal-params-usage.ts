// Example: signal-based mutation with path/query/header parameters.
//
// Mutating endpoints that take path, query, or header parameters generate a
// `${operationId}Mutation(params)` method where the parameters are bound at
// construction time (captured in the closure). The request body is passed to
// `mutate(body)` — this mirrors how Angular `resource()` binds params in the
// `params()` factory.
//
// Parameters accept plain values or signals (like the resource variants);
// the generated code unwraps signals with `readSignalOrValue()` when the
// request is dispatched.
//
// Enable the feature via `runtime: { signalMutations: true }` in your config
// or `--signal-mutations` on the CLI.
//
// Adjust the import path to point at your generated client directory.

import {Component, inject, signal} from '@angular/core';
import {UsersApi} from '../generated/api';

@Component({
  selector: 'app-avatar-upload',
  template: `
    <input type="file" (change)="onFile($event)" />
    <button (click)="upload()" [disabled]="!file || uploading.isLoading()">
      {{ uploading.isLoading() ? 'Uploading…' : 'Upload' }}
    </button>

    @if (uploading.error()) {
      <p class="error">Upload failed.</p>
    }

    @if (uploading.result(); as result) {
      <p>Uploaded to {{ result.url }}</p>
    }
  `,
})
export class AvatarUploadComponent {
  private readonly usersApi = inject(UsersApi);

  file?: Blob;

  // The user id can be a signal — the mutation reads its current value
  // when `mutate()` is invoked.
  readonly userId = signal('usr_123');

  // Path params are bound at construction time. The body (the `FormData`
  // payload) is passed to `mutate(body)` below.
  readonly uploading = this.usersApi.uploadUserAvatarMutation({
    id: this.userId,
  });

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0];
  }

  upload(): void {
    if (!this.file) {
      return;
    }

    // The body is the typed multipart payload: `file` is a `Blob`,
    // `caption` a string. The runtime builds the `FormData` object.
    this.uploading.mutate({
      file: this.file,
      caption: 'Profile photo',
    });
  }
}