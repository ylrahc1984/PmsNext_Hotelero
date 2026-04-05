import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, tap, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoginRequest, LoginResponse } from '../models/auth.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiLoginUrl  = `${environment.apiUrl}/Login/login`;
  private apiRefreshUrl = `${environment.apiUrl}/Login/refresh`;
  private apiLogoutUrl  = `${environment.apiUrl}/Login/logout`;

  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private refreshTimer: any;

  constructor(private http: HttpClient, private router: Router) {
    this.resumeSession();
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  login(usuario: string, clave: string, modulo: string = 'ADMIN', unidad: string = 'HESTAB'): Observable<LoginResponse> {
    const loginRequest: LoginRequest = { usuario, clave, modulo, unidad, respuesta: 'string' };

    return this.http.post<LoginResponse>(this.apiLoginUrl, loginRequest).pipe(
      tap(response => {
        this.saveTokens(response);
        this.currentUserSubject.next(response.usuario[0]);
        this.isAuthenticatedSubject.next(true);
        this.scheduleTokenRefresh(response.expiresIn);
      })
    );
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  refreshAccessToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<LoginResponse>(this.apiRefreshUrl, { refreshToken }).pipe(
      tap(response => {
        this.saveTokens(response);
        if (response.usuario?.[0]?.usuario) {
          this.currentUserSubject.next(response.usuario[0]);
        }
        this.scheduleTokenRefresh(response.expiresIn);
      })
    );
  }

  // ─── Auto-refresh timer ───────────────────────────────────────────────────────

  scheduleTokenRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshIn = (expiresInSeconds - 60) * 1000;

    if (refreshIn <= 0) {
      this.refreshAccessToken().subscribe({ error: () => this.clearSession() });
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().subscribe({ error: () => this.clearSession() });
    }, refreshIn);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  /** Llama al servidor para revocar el refreshToken y limpia la sesión local. */
  logout(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    this.clearSession();

    if (refreshToken) {
      return this.http.post(this.apiLogoutUrl, { refreshToken }).pipe(
        tap(() => this.router.navigate(['/login'])),
        catchError(err => {
          console.warn('Error al cerrar sesión en servidor:', err);
          this.router.navigate(['/login']);
          return of(null);
        })
      );
    }

    this.router.navigate(['/login']);
    return of(null);
  }

  /** Limpia el estado local sin llamar al servidor. Usar en guards/interceptors. */
  clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  // ─── Token helpers ────────────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  getUserFromStorage(): any {
    const userData = localStorage.getItem('user_info');
    return userData ? JSON.parse(userData) : null;
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) { return null; }
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  isTokenExpired(token?: string): boolean {
    const t = token || this.getToken();
    if (!t) { return true; }
    const decoded = this.decodeToken(t);
    if (!decoded?.exp) { return true; }
    return new Date().getTime() >= decoded.exp * 1000;
  }

  // ─── Session resume on page reload ───────────────────────────────────────────

  private saveTokens(response: LoginResponse): void {
    localStorage.setItem('access_token', response.token);
    localStorage.setItem('refresh_token', response.refreshToken);
    if (response.usuario?.[0]) {
      localStorage.setItem('user_info', JSON.stringify(response.usuario[0]));
    }
  }

  private resumeSession(): void {
    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) { return; }

    const decoded = this.decodeToken(token);
    if (decoded?.exp) {
      const remainingSeconds = decoded.exp - Math.floor(new Date().getTime() / 1000);
      this.scheduleTokenRefresh(remainingSeconds);
    }
  }
}
