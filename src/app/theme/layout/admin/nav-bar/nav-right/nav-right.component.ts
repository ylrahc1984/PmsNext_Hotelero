// angular import
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

// bootstrap import
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-nav-right',
  imports: [CommonModule, SharedModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [NgbDropdownConfig]
})
export class NavRightComponent {
  user$ = inject(AuthService).currentUser$;

  private authService = inject(AuthService);

  constructor() {
    const config = inject(NgbDropdownConfig);
    config.placement = 'bottom-right';
  }

  onLogout(): void {
    this.authService.logout().subscribe();
  }
}
