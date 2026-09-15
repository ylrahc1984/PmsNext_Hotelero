import { CommonModule } from '@angular/common';
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
    if (!code || this.enabling() || this.regenerating() || this.isCancelling()) return;
    const newCycle = this.hasPortal() && this.portal()?.estado === 'CAN';
    const confirmation = await Swal.fire(newCycle ? {
      title: '¿Generar un nuevo Guest Portal?',
      text: 'Se creará un nuevo acceso para esta reserva. El portal cancelado se mantendrá como histórico y se generará un nuevo proceso de pre check-in.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, generar nuevo portal',
      cancelButtonText: 'Volver'
    } : {
      title: 'Habilitar Guest Portal',
      text: '¿Desea habilitar el pre check-in digital para esta reserva?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Habilitar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed || this.enabling() || this.regenerating() || this.isCancelling()) return;

    this.enabling.set(true);
    try {
      const response = await firstValueFrom(this.service.enable(code).pipe(takeUntilDestroyed(this.destroyRef)));
      if (code !== this.codReserva().trim()) return;
      if (!response?.success || !response.data?.portal) throw new Error(this.safeMessage(response) || 'No se pudo habilitar Guest Portal.');
      this.hasPortal.set(true);
      this.portal.set(response.data.portal);
      this.accessUrl.set(response.data.access.url);
      this.toast.success(this.safeMessage(response) || (newCycle ? 'Nuevo Guest Portal generado correctamente.' : 'Guest Portal habilitado correctamente.'), 4000, 'Guest Portal');
      this.loadStatus(code);
    } catch (error: unknown) {
      this.toast.error(this.errorMessage(error, 'No se pudo habilitar Guest Portal.'), 5000, 'Guest Portal');
    } finally {
      this.enabling.set(false);
    }
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
    if (!code || this.enabling() || this.regenerating() || this.isCancelling() || this.portal()?.estado !== 'ACT') return;
    const confirmation = await Swal.fire({
      title: '¿Regenerar enlace de acceso?',
      text: 'El enlace anterior dejará de funcionar y las sesiones de acceso existentes del huésped serán cerradas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed || this.enabling() || this.regenerating() || this.isCancelling()) return;

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
    if (!code || this.enabling() || this.isCancelling() || this.regenerating() || this.portal()?.estado !== 'ACT') return;
    const confirmation = await Swal.fire({
      title: '¿Cancelar Guest Portal?',
      text: 'El huésped perderá el acceso al portal y las sesiones activas serán cerradas. Los pre check-ins que aún estén pendientes o en proceso también serán cancelados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar portal',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#b42318'
    });
    if (!confirmation.isConfirmed || this.enabling() || this.isCancelling() || this.regenerating()) return;

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
      const message = value.error?.message ?? value.error?.respuesta;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
    return fallback;
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
