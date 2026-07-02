import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastEmphasis = 'soft' | 'strong';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
  emphasis?: ToastEmphasis;
  icon?: string;
}

export interface ToastConfig {
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
  emphasis?: ToastEmphasis;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();
  private toastId = 0;
  private readonly disabledToastTypes = new Set<ToastType>((environment.disabledToastTypes || []) as ToastType[]);

  show(
    message: string,
    type: ToastType = 'info',
    duration = 5000,
    title?: string
  ): void {
    this.addToast({ message, type, duration, title });
  }

  success(message: string, duration?: number, title?: string): void {
    this.addToast({ message, type: 'success', duration, title, emphasis: 'soft' });
  }

  error(message: string, duration?: number, title?: string): void {
    this.addToast({ message, type: 'error', duration, title, emphasis: 'strong' });
  }

  warning(message: string, duration?: number, title?: string): void {
    this.addToast({ message, type: 'warning', duration, title, emphasis: 'soft' });
  }

  info(message: string, duration?: number, title?: string): void {
    this.addToast({ message, type: 'info', duration, title, emphasis: 'soft' });
  }

  featurePending(message: string, duration = 5000, title = 'Proceso en preparación'): void {
    this.addToast({
      message,
      type: 'info',
      duration,
      title,
      emphasis: 'soft',
      icon: 'feather icon-clock'
    });
  }

  integrationPending(message: string, duration = 5000, title = 'Integración pendiente'): void {
    this.addToast({
      message,
      type: 'warning',
      duration,
      title,
      emphasis: 'soft',
      icon: 'feather icon-link-2'
    });
  }

  actionUnavailable(message: string, duration = 5000, title = 'Acción no disponible'): void {
    this.addToast({
      message,
      type: 'warning',
      duration,
      title,
      emphasis: 'soft',
      icon: 'feather icon-slash'
    });
  }

  connectivityIssue(message: string, duration = 5500, title = 'Conectividad'): void {
    this.addToast({
      message,
      type: 'warning',
      duration,
      title,
      emphasis: 'soft',
      icon: 'feather icon-wifi-off'
    });
  }

  sessionExpired(message: string, duration = 6000, title = 'Sesión expirada'): void {
    this.addToast({
      message,
      type: 'warning',
      duration,
      title,
      emphasis: 'strong',
      icon: 'feather icon-shield-off'
    });
  }

  blockingError(message: string, duration = 6000, title = 'No fue posible completar la acción'): void {
    this.addToast({
      message,
      type: 'error',
      duration,
      title,
      emphasis: 'strong',
      icon: 'feather icon-alert-octagon'
    });
  }

  addToast(config: ToastConfig): void {
    if (this.disabledToastTypes.has(config.type)) {
      return;
    }

    const id = `toast-${++this.toastId}`;
    const toast: Toast = {
      id,
      title: config.title,
      message: config.message,
      type: config.type,
      duration: config.duration ?? 5000,
      emphasis: config.emphasis ?? this.getDefaultEmphasis(config.type),
      icon: config.icon
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-remover después del tiempo especificado
    if ((toast.duration ?? 0) > 0) {
      setTimeout(() => this.remove(id), toast.duration);
    }
  }

  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  removeAll(): void {
    this.toastsSubject.next([]);
  }

  private getDefaultEmphasis(type: ToastType): ToastEmphasis {
    return type === 'error' ? 'strong' : 'soft';
  }
}
