import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container position-fixed p-3" [ngClass]="position">
      <div
        *ngFor="let toast of toasts"
        class="toast show"
        role="alert"
        [ngClass]="'toast-' + toast.type">
        <div class="toast-header d-flex align-items-center">
          <i class="toast-icon" [ngClass]="getIconClass(toast.type)"></i>
          <strong class="ms-2 me-auto">{{ getTitle(toast.type) }}</strong>
          <button
            type="button"
            class="btn-close btn-close-white"
            (click)="toastService.remove(toast.id)"
            aria-label="Close">
          </button>
        </div>
        <div class="toast-body">
          {{ toast.message }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      top: 20px;
      right: 20px;
      z-index: 9999;
    }

    .toast {
      border-radius: 0.5rem;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
    }

    .toast-success .toast-header {
      background-color: #c3e6cb;
      color: #155724;
    }

    .toast-error {
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
    }

    .toast-error .toast-header {
      background-color: #f5c6cb;
      color: #721c24;
    }

    .toast-warning {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
    }

    .toast-warning .toast-header {
      background-color: #ffeaa7;
      color: #856404;
    }

    .toast-info {
      background-color: #d1ecf1;
      border: 1px solid #bee5eb;
      color: #0c5460;
    }

    .toast-info .toast-header {
      background-color: #bee5eb;
      color: #0c5460;
    }

    .toast-icon {
      font-size: 1.25rem;
      font-weight: bold;
    }

    .btn-close-white {
      opacity: 0.7;
      filter: invert(1);
    }

    .btn-close-white:hover {
      opacity: 1;
    }
  `]
})
export class ToastContainerComponent implements OnInit {
  toastService = inject(ToastService);
  toasts: Toast[] = [];
  position = 'end';

  ngOnInit(): void {
    this.toastService.toasts$.subscribe((toasts) => {
      this.toasts = toasts;
    });
  }

  getTitle(type: string): string {
    const titles: { [key: string]: string } = {
      success: 'Éxito',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Información'
    };
    return titles[type] || 'Notificación';
  }

  getIconClass(type: string): string {
    const icons: { [key: string]: string } = {
      success: 'feather icon-check-circle',
      error: 'feather icon-alert-circle',
      warning: 'feather icon-alert-triangle',
      info: 'feather icon-info'
    };
    return icons[type] || 'feather icon-info';
  }
}
