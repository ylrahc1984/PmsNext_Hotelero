// angular import
import { Component, Input, output } from '@angular/core';
import { RouterModule } from '@angular/router';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { APP_BRANDING } from 'src/app/core/config/app-branding';

@Component({
  selector: 'app-nav-logo',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-logo.component.html',
  styleUrls: ['./nav-logo.component.scss']
})
export class NavLogoComponent {
  // public props
  @Input() navCollapsed: boolean;
  NavCollapse = output();
  windowWidth = window.innerWidth;
  readonly branding = APP_BRANDING;

  // public method
  navCollapse() {
    if (this.windowWidth >= 992) {
      this.navCollapsed = !this.navCollapsed;
      this.NavCollapse.emit();
    }
  }
}
