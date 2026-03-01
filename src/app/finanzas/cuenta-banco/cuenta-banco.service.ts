import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { CuentaBanco } from './cuenta-banco.model';

@Injectable({
  providedIn: 'root'
})
export class CuentaBancoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/cuentas-banco`;

  getCuentas(codBanco: string): Observable<CuentaBanco[]> {
    const params = new HttpParams().set('codBanco', codBanco);
    return this.http.get<CuentaBanco[] | CuentaBanco | { data?: CuentaBanco[] }>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeList(response)),
      catchError((error) => this.handleError(error, 'No se pudieron cargar las cuentas bancarias.'))
    );
  }

  getCuenta(codBanco: string, ctaBanco: string): Observable<CuentaBanco | null> {
    const params = new HttpParams().set('codBanco', codBanco).set('ctaBanco', ctaBanco);
    return this.http.get<CuentaBanco[] | CuentaBanco | { data?: CuentaBanco[] }>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeList(response)[0] ?? null),
      catchError((error) => this.handleError(error, 'No se pudo cargar la cuenta bancaria.'))
    );
  }

  createCuenta(payload: CuentaBanco): Observable<CuentaBanco> {
    return this.http.post<CuentaBanco>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo crear la cuenta bancaria.'))
    );
  }

  updateCuenta(codBanco: string, ctaBanco: string, payload: CuentaBanco): Observable<CuentaBanco> {
    const url = `${this.apiUrl}/${encodeURIComponent(codBanco)}/${encodeURIComponent(ctaBanco)}`;
    return this.http.put<CuentaBanco>(url, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo actualizar la cuenta bancaria.'))
    );
  }

  deleteCuenta(codBanco: string, ctaBanco: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(codBanco)}/${encodeURIComponent(ctaBanco)}`;
    return this.http.delete<void>(url).pipe(
      catchError((error) => this.handleError(error, 'No se pudo eliminar la cuenta bancaria.'))
    );
  }

  private normalizeList(response: CuentaBanco[] | CuentaBanco | { data?: CuentaBanco[] }): CuentaBanco[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response && typeof response === 'object' && 'data' in response) {
      const payload = response as { data?: CuentaBanco[] };
      return payload.data ?? [];
    }
    return response ? [response as CuentaBanco] : [];
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const message = this.getErrorMessage(error, fallback);
    return throwError(() => new Error(message));
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = (error.error && (error.error.mensaje || error.error.respuesta || error.error.message)) as
      | string
      | undefined;
    return apiMessage || error.message || fallback;
  }
}
