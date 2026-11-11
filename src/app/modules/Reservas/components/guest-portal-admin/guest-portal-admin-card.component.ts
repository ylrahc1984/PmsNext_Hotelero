import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { GuestPortal, GuestPortalEnableResponse, GuestPortalRegenerateResponse, GuestPortalStatusResponse, GuestPortalStay } from '../../models/guest-portal-admin.model';
import { GuestPortalAdminService } from '../../services/guest-portal-admin.service';

@Component({
  selector: 'app-guest-portal-admin-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guest-portal-admin-card.component.html',
  styleUrl: './guest-portal-admin-card.component.scss'
})
export class GuestPortalAdminCardComponent {
  readonly codReserva = input('');
  readonly loading = signal(false);
  readonly enabling = signal(false);
  readonly regenerating = signal(false);
  readonly isCancelling = signal(false);
  readonly startingNewCycle = signal(false);
  readonly loadError = signal('');
  readonly hasPortal = signal(false);
  readonly portal = signal<GuestPortal | null>(null);
  readonly stays = signal<GuestPortalStay[]>([]);
  readonly accessUrl = signal<string | null>(null);
  private readonly service = inject(GuestPortalAdminService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private requestedCode = '';
  private requestId = 0;

  constructor() {
    effect(() => {
      const code = this.codReserva().trim();
      if (code === this.requestedCode) return;
      this.requestedCode = code;
      this.reset();
      if (code) this.loadStatus(code);
    });
  }

  retry(): void {
    const code = this.codReserva().trim();
    if (code) this.loadStatus(code);
  }

  async enablePortal(): Promise<void> {
    const code = this.codReserva().trim();
    if (!code || this.isBusy()) return;
    const isReactivation = this.hasPortal() && this.portal()?.estado === 'CAN';
    if (this.hasPortal() && !isReactivation) return;
    const confirmation = await Swal.fire(isReactivation ? {
      title: '¿Reactivar Guest Portal?',
      text: 'Se recuperará el portal existente y se generará un nuevo enlace de acceso. Los Pre Check-in completados y sus firmas se conservarán.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reactivar Guest Portal',
      cancelButtonText: 'Cancelar'
    } : {
      title: 'Habilitar Guest Portal',
      text: '¿Desea habilitar el pre check-in digital para esta reserva?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Habilitar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed || this.isBusy()) return;

    this.enabling.set(true);
    try {
      const response = await firstValueFrom(this.service.enable(code).pipe(takeUntilDestroyed(this.destroyRef)));
      if (code !== this.codReserva().trim()) return;
      const url = response?.data?.access?.url;
      if (!response?.success || !response.data?.portal || typeof url !== 'string' || !url.trim()) {
        throw new Error(this.safeMessage(response) || (isReactivation ? 'No se pudo reactivar Guest Portal.' : 'No se pudo habilitar Guest Portal.'));
      }
      this.hasPortal.set(true);
      this.portal.set(response.data.portal);
      this.accessUrl.set(url);
      this.toast.success(this.safeMessage(response) || (isReactivation ? 'Guest Portal reactivado correctamente.' : 'Guest Portal habilitado correctamente.'), 4000, 'Guest Portal');
      this.loadStatus(code);
    } catch (error: unknown) {
      this.toast.error(this.errorMessage(error, 'No se pudo habilitar Guest Portal.'), 5000, 'Guest Portal');
    } finally {
      this.enabling.set(false);
    }
  }

  async startNewPreCheckIn(): Promise<void> {
    const code = this.codReserva().trim();
    const status = this.portal()?.estado;
    if (!code || !this.hasPortal() || status === 'ACT' || this.isBusy()) return;

    const confirmation = await Swal.fire({
      title: '¿Desea iniciar un nuevo Pre Check-in?',
      text: 'Se generará un nuevo enlace de acceso para el huésped. Los registros de Pre Check-in anteriores, las firmas y los documentos históricos se conservarán. Esta operación no modifica ni elimina la información previamente registrada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generar nuevo ciclo',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed || this.isBusy() || this.portal()?.estado === 'ACT') return;

    this.startingNewCycle.set(true);
    try {
      const response = await firstValueFrom(this.service.startNewCycle(code).pipe(takeUntilDestroyed(this.destroyRef)));
      if (code !== this.codReserva().trim()) return;
      const url = response?.data?.access?.url;
      if (!response?.success || !response.data?.portal || typeof url !== 'string' || !url.trim()) {
        throw new Error('No se pudo iniciar un nuevo Pre Check-in.');
      }
      this.hasPortal.set(true);
      this.portal.set(response.data.portal);
      this.accessUrl.set(url);
      this.toast.success(this.safeMessage(response) || 'Nuevo Pre Check-in iniciado correctamente.', 4500, 'Guest Portal');
      this.loadStatus(code);
    } catch (error: unknown) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if (status === 409) {
        this.toast.error('Existe un Guest Portal activo para esta reserva. Se actualizará su estado.', 5000, 'Guest Portal');
        this.accessUrl.set(null);
        this.loadStatus(code);
      } else if (status === 403) {
        this.toast.error('No tiene autorización para administrar el Guest Portal.', 5000, 'Guest Portal');
      } else if (status === 400) {
        this.toast.error(this.validationMessage(error) || 'Los datos no permiten iniciar un nuevo Pre Check-in.', 5000, 'Guest Portal');
      } else if (status === 500 || status >= 500 || status === 0) {
        this.toast.error('No se pudo completar la operación. Intente nuevamente más tarde.', 5000, 'Guest Portal');
      } else {
        this.toast.error(this.errorMessage(error, 'No se pudo iniciar un nuevo Pre Check-in.'), 5000, 'Guest Portal');
      }
    } finally {
      this.startingNewCycle.set(false);
    }
  }

  isBusy(): boolean {
    return this.enabling() || this.regenerating() || this.isCancelling() || this.startingNewCycle();
  }

  async copyAccessUrl(): Promise<void> {
    const url = this.accessUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Enlace copiado.', 3500, 'Guest Portal');
    } catch {
      this.toast.error('No se pudo copiar el enlace. Intente nuevamente.', 4500, 'Guest Portal');
    }
  }

  async regenerateAccessUrl(): Promise<void> {
    const code = this.codReserva().trim();
    if (!code || this.isBusy() || this.portal()?.estado !== 'ACT') return;
    const confirmation = await Swal.fire({
      title: '¿Regenerar enlace de acceso?',
      text: 'El enlace anterior dejará de funcionar y las sesiones de acceso existentes del huésped serán cerradas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed || this.isBusy()) return;

    this.regenerating.set(true);
    try {
      const response = await firstValueFrom(this.service.regenerate(code).pipe(takeUntilDestroyed(this.destroyRef)));
      if (code !== this.codReserva().trim()) return;
      const url = response?.data?.access?.url;
      if (!response?.success || typeof url !== 'string' || !url.trim()) {
        throw new Error(this.safeRegenerateMessage(response) || 'No se pudo regenerar el enlace de acceso.');
      }
      this.accessUrl.set(url);
      this.toast.success(this.safeRegenerateMessage(response) || 'Enlace regenerado correctamente.', 4000, 'Guest Portal');
    } catch (error: unknown) {
      this.toast.error(this.errorMessage(error, 'No se pudo regenerar el enlace de acceso.'), 5000, 'Guest Portal');
    } finally {
      this.regenerating.set(false);
    }
  }

  async cancelPortal(): Promise<void> {
    const code = this.codReserva().trim();
    if (!code || this.isBusy() || this.portal()?.estado !== 'ACT') return;
    const confirmation = await Swal.fire({
      title: '¿Cancelar Guest Portal?',
      text: 'El huésped perderá el acceso al portal y las sesiones activas serán cerradas. Los pre check-ins que aún estén pendientes o en proceso también serán cancelados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar portal',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#b42318'
    });
    if (!confirmation.isConfirmed || this.isBusy()) return;

    this.isCancelling.set(true);
    try {
      const response = await firstValueFrom(this.service.cancel(code).pipe(takeUntilDestroyed(this.destroyRef)));
      if (code !== this.codReserva().trim()) return;
      if (!response?.success) throw new Error(this.safeCancelMessage(response) || 'No se pudo cancelar Guest Portal.');
      this.accessUrl.set(null);
      this.toast.success(this.safeCancelMessage(response) || 'Guest Portal cancelado correctamente.', 4000, 'Guest Portal');
      this.loadStatus(code);
    } catch (error: unknown) {
      this.toast.error(this.errorMessage(error, 'No se pudo cancelar Guest Portal.'), 5000, 'Guest Portal');
    } finally {
      this.isCancelling.set(false);
    }
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Sin accesos';
    const date = normalizePmsDateDDMMYYYY(value);
    const time = value.match(/(?:T|\s)(\d{2}:\d{2})/i)?.[1];
    return date ? `${date}${time ? ` ${time}` : ''}` : value;
  }

  stayStatusLabel(value: string): string {
    const labels: Record<string, string> = { GEN: 'Pendiente', PRO: 'En proceso', COM: 'Completado', CAN: 'Cancelado', EXP: 'Expirado' };
    return labels[value?.trim().toUpperCase()] ?? (value?.trim() || 'Sin estado');
  }

  portalStatusLabel(value: string | null | undefined): string {
    const labels: Record<string, string> = { ACT: 'Activo', CAN: 'Cancelado', CER: 'Cerrado', EXP: 'Expirado' };
    const status = value?.trim().toUpperCase() ?? '';
    return labels[status] ?? (value?.trim() || 'Habilitado');
  }

  private loadStatus(code: string): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.loadError.set('');
    this.service.getStatus(code).pipe(
      finalize(() => { if (requestId === this.requestId) this.loading.set(false); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (requestId === this.requestId && code === this.codReserva().trim()) this.applyStatusResponse(response);
      },
      error: (error: unknown) => {
        if (requestId === this.requestId) this.loadError.set(this.errorMessage(error, 'No se pudo cargar Guest Portal.'));
      }
    });
  }

  private applyStatusResponse(response: GuestPortalStatusResponse): void {
    const data = response.data;
    this.hasPortal.set(Boolean(data?.hasPortal && data.portal));
    this.portal.set(data?.portal ?? null);
    this.stays.set(Array.isArray(data?.stays) ? data.stays : []);
    this.loadError.set('');
  }

  private reset(): void {
    this.requestId++;
    this.loading.set(false);
    this.loadError.set('');
    this.hasPortal.set(false);
    this.portal.set(null);
    this.stays.set([]);
    this.accessUrl.set(null);
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null) {
      const value = error as { error?: { message?: unknown; respuesta?: unknown }; message?: unknown };
      const status = (error as { status?: number }).status;
      if (status === 401) return 'La sesión requiere autenticación. Inicie sesión nuevamente.';
      const message = status === 403 ? null : status >= 500 ? null : value.error?.message ?? value.error?.respuesta;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
    return fallback;
  }

  private validationMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown; title?: unknown } | null;
      const value = body?.message ?? body?.title;
      if (typeof value === 'string' && value.trim() && !/stack|exception| at [\w.]+\(/i.test(value)) return value.trim();
    }
    return '';
  }

  private safeMessage(response: GuestPortalEnableResponse): string {
    return typeof response?.message === 'string' ? response.message.trim() : '';
  }

  private safeRegenerateMessage(response: GuestPortalRegenerateResponse | null | undefined): string {
    return typeof response?.message === 'string' ? response.message.trim() : '';
  }

  private safeCancelMessage(response: { message?: unknown } | null | undefined): string {
    return typeof response?.message === 'string' ? response.message.trim() : '';
  }
}
