// angular import
import { Component, DestroyRef, inject, output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

// project import
import { environment } from 'src/environments/environment';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { NavigationItem, NavigationItems } from '../navigation';
import { navigationItemMatchesUrl } from '../navigation-route.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavGroupComponent } from './nav-group/nav-group.component';
import { NavItemComponent } from './nav-item/nav-item.component';

@Component({
  selector: 'app-nav-content',
  imports: [SharedModule, NavGroupComponent, NavItemComponent],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly empresaContext = inject(EmpresaContextService);

  // public method
  // version
  readonly branding = APP_BRANDING;
  readonly empresa = this.empresaContext.empresa;
  title = 'Application version';
  currentApplicationVersion = environment.appVersion;

  navigations!: NavigationItem[];
  wrapperWidth: number = 0;
  windowWidth = window.innerWidth;
  expandedRootId: string | null = null;

  NavCollapsedMob = output();

  // constructor
  constructor() {
    this.navigations = NavigationItems;
    this.syncExpandedRootWithUrl(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.syncExpandedRootWithUrl(event.urlAfterRedirects);
      });
  }

  fireOutClick() {
    // Mantiene la seccion actualmente expandida en lugar de restaurar por DOM.
  }

  onRootSectionChange(sectionId: string | null) {
    this.expandedRootId = sectionId;
  }

  get empresaNombre(): string {
    const empresa = this.empresa();
    return (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'NEXT Hospitality').trim();
  }

  private syncExpandedRootWithUrl(url: string) {
    this.expandedRootId = this.findRootSectionIdByUrl(url);
  }

  private findRootSectionIdByUrl(url: string): string | null {
    const normalizedUrl = this.normalizeUrl(url);

    for (const navigation of this.navigations) {
      if (navigation.type !== 'group' || !navigation.children) {
        continue;
      }

      for (const section of navigation.children) {
        if (section.type === 'collapse' && navigationItemMatchesUrl(section, normalizedUrl)) {
          return section.id;
        }
      }
    }

    return null;
  }

  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0];
  }
}
