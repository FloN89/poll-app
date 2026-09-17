import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly message = signal('');
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  show(message: string): void {
    this.message.set(message);

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.dismiss(), 4000);
  }

  dismiss(): void {
    this.message.set('');

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
