import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" [ngClass]="position">
      <div
        *ngFor="let toast of toasts"
        class="toast-card"
        role="alert"
        [ngClass]="['toast-' + toast.type, 'toast-' + getEmphasis(toast)]">
        <div class="toast-accent" aria-hidden="true"></div>
        <div class="toast-main">
          <div class="toast-header-row">
            <div class="toast-heading">
              <span class="toast-icon-wrap">
                <i class="toast-icon" [ngClass]="getIconClass(toast)"></i>
              </span>
              <div>
                <strong>{{ getTitle(toast) }}</strong>
                <small>{{ getSubtitle(toast) }}</small>
              </div>
            </div>
            <button
              type="button"
              class="toast-close"
              (click)="toastService.remove(toast.id)"
              aria-label="Close">
            </button>
          </div>
          <div class="toast-body">
            {{ toast.message }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      top: 20px;
      right: 20px;
      position: fixed;
      display: grid;
      gap: 12px;
      width: min(360px, calc(100vw - 32px));
      z-index: 9999;
    }

    .toast-card {
      display: grid;
      grid-template-columns: 5px minmax(0, 1fr);
      overflow: hidden;
      border: 1px solid #d9e5ef;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 16px 32px rgba(11, 31, 52, 0.14);
      animation: slideIn 0.26s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(22px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-main {
      min-width: 0;
      padding: 14px 14px 13px;
    }

    .toast-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .toast-heading {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
    }

    .toast-heading strong {
      display: block;
      color: #17324a;
      font-size: 0.92rem;
      font-weight: 800;
      line-height: 1.15;
    }

    .toast-heading small {
      display: block;
      margin-top: 3px;
      color: #6b7e92;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .toast-body {
      margin-top: 10px;
      color: #30465b;
      font-size: 0.86rem;
      line-height: 1.42;
    }

    .toast-accent {
      background: #cfd9e3;
    }

    .toast-icon-wrap {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 11px;
      background: #eef4f8;
      flex: 0 0 34px;
    }

    .toast-icon {
      font-size: 1rem;
    }

    .toast-close {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      background: transparent;
      position: relative;
      opacity: 0.72;
      flex: 0 0 28px;
      cursor: pointer;
    }

    .toast-close::before,
    .toast-close::after {
      position: absolute;
      top: 13px;
      left: 7px;
      width: 14px;
      height: 2px;
      border-radius: 999px;
      background: #607487;
      content: '';
    }

    .toast-close::before {
      transform: rotate(45deg);
    }

    .toast-close::after {
      transform: rotate(-45deg);
    }

    .toast-close:hover {
      opacity: 1;
    }

    .toast-success.toast-soft .toast-accent { background: linear-gradient(180deg, #2ac886, #179b63); }
    .toast-success.toast-soft .toast-icon-wrap { background: #e8f8ef; color: #179b63; }

    .toast-info.toast-soft .toast-accent { background: linear-gradient(180deg, #5eb7ff, #2f7de0); }
    .toast-info.toast-soft .toast-icon-wrap { background: #eaf4ff; color: #2f7de0; }

    .toast-warning.toast-soft .toast-accent { background: linear-gradient(180deg, #f3c56f, #d8962d); }
    .toast-warning.toast-soft .toast-icon-wrap { background: #fff7e6; color: #b87a17; }

    .toast-warning.toast-strong .toast-accent { background: linear-gradient(180deg, #f0aa3b, #bf7413); }
    .toast-warning.toast-strong .toast-icon-wrap { background: #fff0d2; color: #a86510; }

    .toast-error.toast-strong {
      border-color: #f1c7cd;
      background: linear-gradient(180deg, #fff8f8, #ffffff);
    }

    .toast-error.toast-strong .toast-accent { background: linear-gradient(180deg, #ef6a76, #c73643); }
    .toast-error.toast-strong .toast-icon-wrap { background: #fff0f1; color: #c73643; }

    .toast-error.toast-soft .toast-accent { background: linear-gradient(180deg, #f29ca7, #d95a67); }
    .toast-error.toast-soft .toast-icon-wrap { background: #fff4f5; color: #d95a67; }
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

  getTitle(toast: Toast): string {
    if (toast.title) {
      return toast.title;
    }

    const titles: Record<string, string> = {
      success: 'Operación completada',
      error: 'Atención requerida',
      warning: 'Revisión operativa',
      info: 'Aviso operativo'
    };

    return titles[toast.type] || 'Notificación';
  }

  getSubtitle(toast: Toast): string {
    const subtitles: Record<string, string> = {
      success: 'Confirmación',
      error: 'Seguimiento',
      warning: 'Estado del proceso',
      info: 'Contexto'
    };

    return subtitles[toast.type] || 'Contexto';
  }

  getIconClass(toast: Toast): string {
    if (toast.icon) {
      return toast.icon;
    }

    const icons: Record<string, string> = {
      success: 'feather icon-check-circle',
      error: 'feather icon-alert-octagon',
      warning: 'feather icon-alert-triangle',
      info: 'feather icon-info'
    };

    return icons[toast.type] || 'feather icon-info';
  }

  getEmphasis(toast: Toast): string {
    return toast.emphasis || (toast.type === 'error' ? 'strong' : 'soft');
  }
}
