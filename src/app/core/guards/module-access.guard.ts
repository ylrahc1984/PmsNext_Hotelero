import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanMatch, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { ModuleAccessMode } from '../models/module-access.models';
import { AuthService } from '../services/auth.service';
import { ModuleAccessService } from '../services/module-access.service';

@Injectable({ providedIn: 'root' })
export class ModuleAccessGuard implements CanActivate, CanMatch {
  private readonly auth = inject(AuthService);
  private readonly moduleAccess = inject(ModuleAccessService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> | boolean | UrlTree {
    return this.authorize(route.data['requiredModules'], route.data['moduleAccessMode']);
  }

  canMatch(route: Route, _segments: UrlSegment[]): Observable<boolean | UrlTree> | boolean | UrlTree {
    return this.authorize(route.data?.['requiredModules'], route.data?.['moduleAccessMode']);
  }

  private authorize(
    requiredModules: readonly string[] | undefined,
    mode: ModuleAccessMode | undefined
  ): Observable<boolean | UrlTree> | boolean | UrlTree {
    if (!requiredModules?.length) {
      return true;
    }

    const usuario = this.auth.getCurrentUser()?.usuario?.toString().trim() ?? '';
    if (!usuario) {
      return this.router.createUrlTree(['/login']);
    }

    return this.moduleAccess.loadForUser(usuario).pipe(
      map((_) =>
        this.moduleAccess.hasAccess(requiredModules, mode ?? 'any')
          ? true
          : this.router.createUrlTree(['/dashboard'], { queryParams: { accesoDenegado: 'modulo' } })
      ),
      catchError(() => of(this.router.createUrlTree(['/dashboard'], { queryParams: { accesoDenegado: 'carga' } })))
    );
  }
}

