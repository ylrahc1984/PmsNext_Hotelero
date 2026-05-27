import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private isLogoutInProgress = false;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  private handleError(error: HttpErrorResponse): void {
    // Evitar múltiples logout simultaneos
    if (this.isLogoutInProgress) {
      return;
    }

    switch (error.status) {
      case 403: // Prohibido
        this.handleForbidden();
        break;
      case 0: // Error de conexión
        this.handleConnectionError();
        break;
      default:
        this.handleGenericError(error);
    }
  }

  private handleForbidden(): void {
    console.warn('Error 403: Acceso prohibido. Token inválido o expirado.');
    this.toastService.error('Acceso denegado. Su sesión ha expirado.');
    this.performLogout();
  }

  private handleConnectionError(): void {
    console.error('Error de conexión con el servidor.');
    this.toastService.warning('No se puede conectar con el servidor. Verifique su conexión.');
    // No hacer logout en errores de conexión, permitir reintentos
  }

  private async handleGenericError(error: HttpErrorResponse): Promise<void> {
    const backendMessage = await this.resolveBackendMessage(error);

    console.error('Error HTTP:', {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      url: error.url,
      backend: backendMessage || error.error
    });

    const message = backendMessage || `Error ${error.status}: ${error.statusText}`;
    this.toastService.error(message);
  }

  private async resolveBackendMessage(error: HttpErrorResponse): Promise<string> {
    if (error.error instanceof Blob) {
      return (await error.error.text()).trim();
    }

    if (typeof error.error === 'string') {
      return error.error.trim();
    }

    return (error.error?.mensaje || error.error?.respuesta || error.error?.message || error.error?.error || '').toString().trim();
  }

  private performLogout(): void {
    this.isLogoutInProgress = true;
    this.authService.logout().subscribe({
      complete: () => { this.isLogoutInProgress = false; }
    });
  }
}
