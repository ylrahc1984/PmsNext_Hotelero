import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { Banco } from './banco.model';

@Injectable({
  providedIn: 'root'
})
export class BancosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/bancos`;

  getBancos(): Observable<Banco[]> {
    return this.http.get<Banco[] | { data?: Banco[] }>(this.apiUrl).pipe(
      map((response) => (Array.isArray(response) ? response : response?.data ?? [])),
      catchError((error) => this.handleError(error, 'No se pudieron cargar los bancos.'))
    );
  }

  createBanco(payload: Banco): Observable<Banco> {
    return this.http.post<Banco>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo crear el banco.'))
    );
  }

  updateBanco(codBanco: string, payload: Banco): Observable<Banco> {
    const url = `${this.apiUrl}/${encodeURIComponent(codBanco)}`;
    return this.http.put<Banco>(url, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo actualizar el banco.'))
    );
  }

  deleteBanco(codBanco: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(codBanco)}`;
    return this.http.delete<void>(url).pipe(
      catchError((error) => this.handleError(error, 'No se pudo eliminar el banco.'))
    );
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
