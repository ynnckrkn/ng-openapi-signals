// Example: multipart file upload with FormData.
//
// When a request body uses `multipart/form-data`, the generator emits
// `formData: body` instead of `body:`. The runtime builds a `FormData`
// object from the typed input. Binary parts (`format: binary`) are typed
// as `Blob`.
//
// The browser sets the `Content-Type` with the multipart boundary
// automatically — do not set it manually.
//
// Adjust the import path to point at your generated client directory.

import {Component, inject} from '@angular/core';
import {UsersApi} from '../generated/api';

@Component({
  selector: 'app-avatar-upload',
  template: `
    <input type="file" (change)="onFile($event)" />
    <button (click)="upload()" [disabled]="!file || busy">
      {{ busy ? 'Uploading…' : 'Upload' }}
    </button>
  `,
})
export class AvatarUploadComponent {
  private readonly usersApi = inject(UsersApi);

  file?: Blob;
  busy = false;

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0];
  }

  async upload(): Promise<void> {
    if (!this.file) {
      return;
    }

    this.busy = true;

    try {
      const result = await this.usersApi.uploadUserAvatar(
        // The body is a typed object — `file` is a `Blob`, `caption` a string.
        {file: this.file, caption: 'Profile photo'},
        // Path parameters are passed as the second argument.
        {id: 'usr_123'},
      );

      console.log('Uploaded avatar', result);
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      this.busy = false;
    }
  }
}