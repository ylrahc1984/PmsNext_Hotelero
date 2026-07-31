// angular import
import { Component, DestroyRef, inject, output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

// project import
import { environment } from 'src/environments/environment';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';
import { ModuleAccessState } from 'src/app/core/models/module-access.models';
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
  private readonly auth = inject(AuthService);
  private readonly moduleAccess = inject(ModuleAccessService);

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
    this.navigations = this.buildNavigation(this.moduleAccess.snapshot);
    this.moduleAccess.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.navigations = this.buildNavigation(state);
        this.syncExpandedRootWithUrl(this.router.url);
      });
    this.loadModuleAccess();
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

  private loadModuleAccess(): void {
    const usuario = this.auth.getCurrentUser()?.usuario?.toString().trim() ?? '';
    if (!usuario) {
      return;
    }

    this.moduleAccess
      .loadForUser(usuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => console.error('No se pudieron cargar los accesos a módulos:', error)
      });
  }

  private buildNavigation(state: ModuleAccessState): NavigationItem[] {
    return NavigationItems.map((item) => this.buildNavigationItem(item, state));
  }

  private buildNavigationItem(item: NavigationItem, state: ModuleAccessState): NavigationItem {
    const staticallyLocked = item.locked === true;
    const requiresAccess = Boolean(item.requiredModules?.length);
    const deniedByModule = requiresAccess
      ? !this.moduleAccess.hasAccess(item.requiredModules ?? [], item.moduleAccessMode ?? 'any', state)
      : false;

    return {
      ...item,
      locked: staticallyLocked || deniedByModule,
      lockReason: this.resolveLockReason(staticallyLocked, deniedByModule, state),
      children: item.children?.map((child) => this.buildNavigationItem(child, state))
    };
  }

  private resolveLockReason(staticallyLocked: boolean, deniedByModule: boolean, state: ModuleAccessState): string | undefined {
    if (staticallyLocked) {
      return 'Esta opción no está disponible actualmente';
    }
    if (!deniedByModule) {
      return undefined;
    }
    if (state.status === 'loading' || state.status === 'idle') {
      return 'Verificando acceso al módulo';
    }
    if (state.status === 'error') {
      return 'No fue posible verificar el acceso al módulo';
    }
    return 'No tienes acceso a este módulo';
  }
}
