// angular import
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

// bootstrap import
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';
import { LockScreenService } from 'src/app/core/services/lock-screen.service';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { SolicitudHuesped } from 'src/app/modules/clientes-huespedes/solicitudes-huespedes/solicitudes-huespedes.models';
import { GuestRequestNotificationService } from 'src/app/modules/clientes-huespedes/solicitudes-huespedes/guest-request-notification.service';
import { PUSH_DIAG_VERSION, PushNotificationService } from 'src/app/core/services/push-notification.service';
import { OperationalDateIndicatorComponent } from '../operational-date-indicator/operational-date-indicator.component';

@Component({
  selector: 'app-nav-right',
  imports: [CommonModule, RouterModule, SharedModule, OperationalDateIndicatorComponent],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [NgbDropdownConfig]
})
export class NavRightComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly moduleAccess = inject(ModuleAccessService);
  user$ = this.authService.currentUser$;
  readonly quickOccupancyRequested = output<void>();
  canUseQuickOccupancy = false;
  readonly branding = APP_BRANDING;
  private readonly guestRequestNotifications = inject(GuestRequestNotificationService);
  private readonly pushNotifications = inject(PushNotificationService);
  readonly pendingGuestRequests = this.guestRequestNotifications.pendientesRecientes;
  readonly pendingGuestRequestCount = this.guestRequestNotifications.cantidadPendientes;
  readonly pushState = this.pushNotifications.state;

  private lockScreenService = inject(LockScreenService);

  constructor() {
    const config = inject(NgbDropdownConfig);
    config.placement = 'bottom-right';
    this.authService.currentUser$
      .pipe(
        switchMap((user) => {
          this.canUseQuickOccupancy = false;
          const usuario = user?.usuario?.toString().trim() ?? '';
          if (!usuario) return of(false);
          return this.moduleAccess.loadForUser(usuario).pipe(
            map(() => this.hasQuickOccupancyAccess()),
            catchError(() => of(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((allowed) => (this.canUseQuickOccupancy = allowed));
    this.guestRequestNotifications.start();
    this.pushNotifications.refreshAvailability();
    console.info(`[PUSH-DIAG] VERSION: ${PUSH_DIAG_VERSION}`);
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }

  requestQuickOccupancy(): void {
    if (!this.canUseQuickOccupancy || !this.hasQuickOccupancyAccess()) return;
    this.quickOccupancyRequested.emit();
  }

  onLockScreen(): void {
    this.lockScreenService.requestLock();
  }

  activatePushNotifications(): void {
    void this.pushNotifications.activate();
  }

  deactivatePushNotifications(): void {
    console.info('[PUSH-DIAG] COMPONENT_DEACTIVATE_START');
    void this.pushNotifications.deactivate();
  }

  notificationBadgeLabel(): string {
    const count = this.pendingGuestRequestCount();
    return count > 99 ? '99+' : String(count);
  }

  notificationAriaLabel(): string {
    const count = this.pendingGuestRequestCount();
    if (count === 0) return 'No hay solicitudes de huéspedes pendientes';
    return count === 1 ? '1 solicitud de huésped pendiente' : `${count} solicitudes de huéspedes pendientes`;
  }

  requestElapsedLabel(request: SolicitudHuesped): string {
    const minutes = request.minutosDesdeSolicitud;
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) {
      return minutes < 60 ? `Hace ${minutes} min` : `Hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    }

    return 'Tiempo no disponible';
  }

  trackRequest(_: number, request: SolicitudHuesped): number {
    return request.idSolicitud;
  }

  private hasQuickOccupancyAccess(): boolean {
    const usuario = this.authService.getCurrentUser()?.usuario?.toString().trim() ?? '';
    const state = this.moduleAccess.snapshot;
    return (
      !!usuario &&
      state.usuario.trim().toUpperCase() === usuario.toUpperCase() &&
      this.moduleAccess.hasAccess(['FRONT', 'RESER'], 'any', state)
    );
  }
}
