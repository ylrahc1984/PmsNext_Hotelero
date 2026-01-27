import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';

export interface CanDeactivateReservaCreate {
  canDeactivate: (nextUrl?: string) => boolean | Promise<boolean> | Observable<boolean>;
}

@Injectable({ providedIn: 'root' })
export class CanDeactivateReservaCreateGuard implements CanDeactivate<CanDeactivateReservaCreate> {
  canDeactivate(
    component: CanDeactivateReservaCreate,
    _currentRoute: ActivatedRouteSnapshot,
    _currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (!component?.canDeactivate) return true;
    return component.canDeactivate(nextState?.url);
  }
}

