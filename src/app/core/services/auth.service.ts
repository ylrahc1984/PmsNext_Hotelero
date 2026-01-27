import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { LoginRequest, LoginResponse, AuthToken } from '../models/auth.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/Login/login`;
  
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkTokenExpiration();
  }

  /**
   * Realiza el login con usuario y contraseña
   */
  login(usuario: string, clave: string, modulo: string = 'ADMIN', unidad: string = 'HESTAB'): Observable<LoginResponse> {
    const loginRequest: LoginRequest = {
      usuario,
      clave,
      modulo,
      unidad,
      respuesta: 'string'
    };

    return this.http.post<LoginResponse>(this.apiUrl, loginRequest).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setUserData(response);
        this.currentUserSubject.next(response.usuario[0]);
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  /**
   * Obtiene el token almacenado
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Verifica si hay un token válido
   */
  hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Almacena el token
   */
  private setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  /**
   * Almacena los datos del usuario
   */
  private setUserData(response: LoginResponse): void {
    localStorage.setItem('user_data', JSON.stringify(response.usuario[0]));
  }

  /**
   * Obtiene los datos del usuario almacenados
   */
  getUserFromStorage(): any {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Obtiene el usuario actual
   */
  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  /**
   * Decodifica el JWT para obtener información (sin validar firma)
   */
  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const decoded = JSON.parse(atob(parts[1]));
      return decoded;
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }

  /**
   * Verifica si el token ha expirado
   */
  isTokenExpired(token?: string): boolean {
    const t = token || this.getToken();
    if (!t) return true;

    const decoded = this.decodeToken(t);
    if (!decoded || !decoded.exp) return true;

    const expirationTime = decoded.exp * 1000;
    const currentTime = new Date().getTime();

    return currentTime >= expirationTime;
  }

  /**
   * Verifica la expiración del token periódicamente
   */
  private checkTokenExpiration(): void {
    setInterval(() => {
      if (this.hasToken() && this.isTokenExpired()) {
        this.logout();
      }
    }, 60000); // Verificar cada minuto
  }

  /**
   * Realiza logout y limpia los datos almacenados
   */
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }
}
