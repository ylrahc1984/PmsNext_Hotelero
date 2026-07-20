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

  private authService = inject(AuthService);
  private lockScreenService = inject(LockScreenService);

  constructor() {
    const config = inject(NgbDropdownConfig);
    config.placement = 'bottom-right';
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }

  onLockScreen(): void {
    this.lockScreenService.requestLock();
  }
}
