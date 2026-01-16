import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();
  private toastId = 0;

  show(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 5000,
    title?: string
  ): void {
    const id = `toast-${++this.toastId}`;
    const toast: Toast = {
      id,
      title,
      message,
      type,
      duration
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-remover después del tiempo especificado
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  success(message: string, duration?: number, title?: string): void {
    this.show(message, 'success', duration, title);
  }

  error(message: string, duration?: number, title?: string): void {
    this.show(message, 'error', duration, title);
  }

  warning(message: string, duration?: number, title?: string): void {
    this.show(message, 'warning', duration, title);
  }

  info(message: string, duration?: number, title?: string): void {
    this.show(message, 'info', duration, title);
  }

  addToast(config: { title?: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number }): void {
    this.show(config.message, config.type, config.duration, config.title);
  }

  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  removeAll(): void {
    this.toastsSubject.next([]);
  }
}
