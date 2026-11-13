// angular import
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// project import
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { ConfigurationComponent } from 'src/app/theme/layout/admin/configuration/configuration.component';
import { BreadcrumbsComponent } from '../../shared/components/breadcrumbs/breadcrumbs.component';
import { Footer } from './footer/footer';
import { LockScreenComponent } from 'src/app/core/components/lock-screen/lock-screen.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';
import { QuickOccupancyComponent } from 'src/app/modules/front-desk/pages/quick-occupancy/quick-occupancy.component';

@Component({
  selector: 'app-admin',
  imports: [
    NavBarComponent,
    NavigationComponent,
    RouterModule,
    CommonModule,
    ConfigurationComponent,
    BreadcrumbsComponent,
    Footer,
    LockScreenComponent,
    QuickOccupancyComponent
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private readonly auth = inject(AuthService);
  private readonly moduleAccess = inject(ModuleAccessService);

  // public props
  navCollapsed;
  navCollapsedMob: boolean;
  windowWidth: number;
  quickOccupancyOpen = false;

  get canUseQuickOccupancy(): boolean {
    return this.hasQuickOccupancyAccess();
  }

  get canOpenFullForecast(): boolean {
    const usuario = this.currentUsername();
    const state = this.moduleAccess.snapshot;
    return (
      !!usuario && state.usuario.trim().toUpperCase() === usuario.toUpperCase() && this.moduleAccess.hasAccess(['FRONT'], 'any', state)
    );
  }

  requestQuickOccupancy(): void {
    const usuario = this.currentUsername();
    const state = this.moduleAccess.snapshot;
    const authorized =
      !!usuario &&
      state.usuario.trim().toUpperCase() === usuario.toUpperCase() &&
      this.moduleAccess.hasAccess(['FRONT', 'RESER'], 'any', state);
    if (authorized) this.quickOccupancyOpen = true;
  }

  onQuickOccupancyOpenChange(open: boolean): void {
    this.quickOccupancyOpen = open && this.hasQuickOccupancyAccess();
  }

  private currentUsername(): string {
    return this.auth.getCurrentUser()?.usuario?.toString().trim() ?? '';
  }

  private hasQuickOccupancyAccess(): boolean {
    const usuario = this.currentUsername();
    const state = this.moduleAccess.snapshot;
    return (
      !!usuario &&
      state.usuario.trim().toUpperCase() === usuario.toUpperCase() &&
      this.moduleAccess.hasAccess(['FRONT', 'RESER'], 'any', state)
    );
  }

  // constructor
  constructor() {
    this.windowWidth = window.innerWidth;
    this.navCollapsedMob = false;
  }

  // public method
  navMobClick() {
    if (this.navCollapsedMob && !document.querySelector('app-navigation.pcoded-navbar').classList.contains('mob-open')) {
      this.navCollapsedMob = !this.navCollapsedMob;
      setTimeout(() => {
        this.navCollapsedMob = !this.navCollapsedMob;
      }, 100);
    } else {
      this.navCollapsedMob = !this.navCollapsedMob;
    }
  }

  // this is for eslint rule
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    if (document.querySelector('app-navigation.pcoded-navbar').classList.contains('mob-open')) {
      document.querySelector('app-navigation.pcoded-navbar').classList.remove('mob-open');
    }
  }
}
