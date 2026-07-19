// Angular Import
import { Component, DestroyRef, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, startWith } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

// project import
import { NavigationItem, NavigationItems } from 'src/app/theme/layout/admin/navigation/navigation';
import { SharedModule } from '../../shared.module';

interface titleType {
  // eslint-disable-next-line
  url: string | boolean | any | undefined;
  title: string;
  breadcrumbs: unknown;
  type: string;
}

interface RouteBreadcrumb {
  title: string;
  url?: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent {
  private route = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private titleService = inject(Title);
  private destroyRef = inject(DestroyRef);

  // public props
  @Input() type: string;

  navigations: NavigationItem[];
  breadcrumbList: string[] = [];
  navigationList: titleType[] = [];

  // constructor
  constructor() {
    this.navigations = NavigationItems;
    this.type = 'theme1';
    this.setBreadcrumb();
  }

  // public method
  setBreadcrumb() {
    this.route.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const routeBreadcrumbs = this.getRouteBreadcrumbs();
        this.navigationList = routeBreadcrumbs.length
          ? routeBreadcrumbs.map((breadcrumb, index) => ({
              url: breadcrumb.url || false,
              title: breadcrumb.title,
              breadcrumbs: true,
              type: index === routeBreadcrumbs.length - 1 ? 'item' : 'collapse'
            }))
          : this.filterNavigation(this.navigations, this.normalizeUrl(this.route.url));
        this.titleService.setTitle('PMS - Sistema de Gestión Hotelera');
      });
  }

  filterNavigation(navItems: NavigationItem[], activeLink: string): titleType[] {
    for (const navItem of navItems) {
      if (navItem.type === 'item' && 'url' in navItem && this.normalizeUrl(navItem.url || '') === activeLink) {
        return [
          {
            url: 'url' in navItem ? navItem.url : false,
            title: navItem.title,
            breadcrumbs: 'breadcrumbs' in navItem ? navItem.breadcrumbs : true,
            type: navItem.type
          }
        ];
      }
      if ((navItem.type === 'group' || navItem.type === 'collapse') && 'children' in navItem) {
        const breadcrumbList = this.filterNavigation(navItem.children!, activeLink);
        if (breadcrumbList.length > 0) {
          breadcrumbList.unshift({
            url: 'url' in navItem ? navItem.url : false,
            title: navItem.title,
            breadcrumbs: 'breadcrumbs' in navItem ? navItem.breadcrumbs : true,
            type: navItem.type
          });
          return breadcrumbList;
        }
      }
    }
    return [];
  }

  private getRouteBreadcrumbs(): RouteBreadcrumb[] {
    let currentRoute: ActivatedRoute | null = this.activatedRoute.root;
    let breadcrumbs: RouteBreadcrumb[] = [];

    while (currentRoute) {
      const routeBreadcrumbs = currentRoute.snapshot.data['breadcrumbTrail'];
      if (Array.isArray(routeBreadcrumbs)) {
        breadcrumbs = routeBreadcrumbs as RouteBreadcrumb[];
      }
      currentRoute = currentRoute.firstChild;
    }

    return breadcrumbs;
  }

  private normalizeUrl(url: string): string {
    return (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  }
}
