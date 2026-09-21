// angular import
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

// bootstrap import
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { LockScreenService } from 'src/app/core/services/lock-screen.service';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { SolicitudHuesped } from 'src/app/modules/clientes-huespedes/solicitudes-huespedes/solicitudes-huespedes.models';
import { GuestRequestNotificationService } from 'src/app/modules/clientes-huespedes/solicitudes-huespedes/guest-request-notification.service';
import { OperationalDateIndicatorComponent } from '../operational-date-indicator/operational-date-indicator.component';

@Component({
  selector: 'app-nav-right',
  imports: [CommonModule, RouterModule, SharedModule, OperationalDateIndicatorComponent],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [NgbDropdownConfig]
})
export class NavRightComponent {
  user$ = inject(AuthService).currentUser$;
  readonly branding = APP_BRANDING;
  private readonly guestRequestNotifications = inject(GuestRequestNotificationService);
  readonly pendingGuestRequests = this.guestRequestNotifications.pendientesRecientes;
  readonly pendingGuestRequestCount = this.guestRequestNotifications.cantidadPendientes;

  private authService = inject(AuthService);
  private lockScreenService = inject(LockScreenService);

  constructor() {
    const config = inject(NgbDropdownConfig);
    config.placement = 'bottom-right';
    this.guestRequestNotifications.start();
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }

  onLockScreen(): void {
    this.lockScreenService.requestLock();
  }

  notificationBadgeLabel(): string {
    const count = this.pendingGuestRequestCount();
    return count > 99 ? '99+' : String(count);
  }

  notificationAriaLabel(): string {
    const count = this.pendingGuestRequestCount();
    if (count === 0) return 'No hay solicitudes de huéspedes pendientes';
    return count === 1
      ? '1 solicitud de huésped pendiente'
      : `${count} solicitudes de huéspedes pendientes`;
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
}
