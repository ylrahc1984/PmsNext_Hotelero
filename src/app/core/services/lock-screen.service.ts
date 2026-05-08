import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const LOCKED_KEY = 'ope_tours_lock_screen_locked';
const PIN_HASH_KEY = 'ope_tours_lock_screen_pin_hash';

@Injectable({
  providedIn: 'root'
})
export class LockScreenService {
  private lockedSubject = new BehaviorSubject<boolean>(this.getStoredLocked());
  readonly locked$ = this.lockedSubject.asObservable();

  private setupModeSubject = new BehaviorSubject<boolean>(false);
  readonly setupMode$ = this.setupModeSubject.asObservable();

  requestLock(): void {
    this.setupModeSubject.next(true);
    this.lockedSubject.next(true);
  }

  async setPin(pin: string): Promise<void> {
    const hash = await this.hashPin(pin);
    sessionStorage.setItem(PIN_HASH_KEY, hash);
    sessionStorage.setItem(LOCKED_KEY, 'true');
    this.setupModeSubject.next(false);
    this.lockedSubject.next(true);
  }

  async unlock(pin: string): Promise<boolean> {
    const storedHash = sessionStorage.getItem(PIN_HASH_KEY);

    if (!storedHash) {
      this.clear();
      return true;
    }

    const hash = await this.hashPin(pin);
    const valid = hash === storedHash;

    if (valid) {
      this.clear();
    }

    return valid;
  }

  clear(): void {
    sessionStorage.removeItem(LOCKED_KEY);
    sessionStorage.removeItem(PIN_HASH_KEY);
    this.setupModeSubject.next(false);
    this.lockedSubject.next(false);
  }

  private getStoredLocked(): boolean {
    return sessionStorage.getItem(LOCKED_KEY) === 'true';
  }

  private async hashPin(pin: string): Promise<string> {
    const bytes = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}
