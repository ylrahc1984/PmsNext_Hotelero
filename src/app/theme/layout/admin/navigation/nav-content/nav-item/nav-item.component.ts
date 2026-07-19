// angular import
import { Component, inject, input, output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

// project import
import { NavigationItem } from '../../navigation';
import { navigationItemMatchesUrl } from '../../navigation-route.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-nav-item',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-item.component.html',
  styleUrls: ['./nav-item.component.scss']
})
export class NavItemComponent {
  private readonly router = inject(Router);
  // public props
  item = input<NavigationItem>();
  rootSectionId = input<string | null>(null);
  rootSectionChange = output<string | null>();

  get isActive(): boolean {
    return navigationItemMatchesUrl(this.item(), this.router.url);
  }

  // public method
  closeOtherMenu(event: MouseEvent) {
    if (this.rootSectionId()) {
      this.rootSectionChange.emit(this.rootSectionId());
    }

    if (document.querySelector('app-navigation.pcoded-navbar').classList.contains('mob-open')) {
      document.querySelector('app-navigation.pcoded-navbar').classList.remove('mob-open');
    }
  }
}
