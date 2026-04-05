import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const token = this.authService.getToken();
    
    // Si no hay token, redirigir a login
    if (!token) {
      return this.router.createUrlTree(['/login']);
    }

    // Si el token está expirado, hacer logout y redirigir a login
    if (this.authService.isTokenExpired(token)) {
      this.authService.clearSession();
      return this.router.createUrlTree(['/login']);
    }

    // Si hay token válido, permitir acceso
    return true;
  }

  canActivateChild(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate();
  }
}
