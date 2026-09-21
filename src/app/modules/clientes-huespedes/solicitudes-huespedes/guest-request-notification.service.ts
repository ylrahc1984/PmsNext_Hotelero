import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';
import { SolicitudHuesped } from './solicitudes-huespedes.models';
import { EMPTY, Observable, catchError, distinctUntilChanged, exhaustMap, finalize, fromEvent, interval, merge, of, switchMap, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GuestRequestNotificationService {
  private static readonly POLLING_INTERVAL_MS = 30_000;

  private readonly solicitudesService = inject(SolicitudHuespedService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendientesState = signal<SolicitudHuesped[]>([]);
  private readonly cargandoState = signal(false);
  private readonly knownIds = new Set<number>();
  private initialized = false;
  private started = false;

  readonly pendientes = this.pendientesState.asReadonly();
  readonly cantidadPendientes = computed(() => this.pendientesState().length);
  readonly pendientesRecientes = computed(() => [...this.pendientesState()]
    .sort((left, right) => this.requestTimestamp(right) - this.requestTimestamp(left))
    .slice(0, 5));
  readonly cargando = this.cargandoState.asReadonly();

  start(): void {
    if (this.started) return;
    this.started = true;

    this.authService.isAuthenticated$
      .pipe(
        distinctUntilChanged(),
        tap((authenticated) => {
          if (!authenticated) this.resetSessionState();
        }),
        switchMap((authenticated) => authenticated ? this.monitoringStream() : EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private monitoringStream(): Observable<SolicitudHuesped[]> {
    return merge(
      of(null),
      interval(GuestRequestNotificationService.POLLING_INTERVAL_MS),
      fromEvent(window, 'focus')
    ).pipe(
      exhaustMap(() => {
        this.cargandoState.set(true);
        return this.solicitudesService.consultar({ estado: 'PEN' }).pipe(
          catchError(() => EMPTY),
          finalize(() => this.cargandoState.set(false))
        );
      }),
      tap((pending) => this.applyPending(pending))
    );
  }

  private applyPending(rows: SolicitudHuesped[]): void {
    const pending = (Array.isArray(rows) ? rows : []).filter((item) => item.estado === 'PEN');

    if (!this.initialized) {
      pending.forEach((item) => this.rememberId(item.idSolicitud));
      this.initialized = true;
      this.pendientesState.set(pending);
      return;
    }

    const newRequests = pending.filter((item) => !this.knownIds.has(item.idSolicitud));
    pending.forEach((item) => this.rememberId(item.idSolicitud));
    this.pendientesState.set(pending);
    this.notifyNewRequests(newRequests);
  }

  private notifyNewRequests(newRequests: SolicitudHuesped[]): void {
    if (newRequests.length === 0) return;

    if (newRequests.length === 1) {
      const request = newRequests[0];
      const room = request.numHabitacion?.trim();
      const type = request.tipoSolicitud?.trim() || 'Solicitud de huésped';
      this.toast.info(`${room ? roomLabel(room) : 'Habitación sin asignar'} · ${type}`, 6500, 'Nueva solicitud de huésped');
      return;
    }

    this.toast.info(`Se recibieron ${newRequests.length} nuevas solicitudes.`, 6500, 'Nuevas solicitudes de huéspedes');
  }

  private rememberId(idSolicitud: number): void {
    const id = Number(idSolicitud);
    if (Number.isInteger(id) && id > 0) this.knownIds.add(id);
  }

  private resetSessionState(): void {
    this.knownIds.clear();
    this.initialized = false;
    this.pendientesState.set([]);
    this.cargandoState.set(false);
  }

  private requestTimestamp(request: SolicitudHuesped): number {
    const timestamp = new Date(request.fechaSolicitud).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
}

function roomLabel(room: string): string {
  return room.toLowerCase().startsWith('hab.') ? room : `Habitación ${room}`;
}
