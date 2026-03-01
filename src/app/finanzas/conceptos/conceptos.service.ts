import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { Concepto, ConceptosResponse } from './concepto.model';

@Injectable({
  providedIn: 'root'
})
export class ConceptosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/conceptos`;

  getConceptos(
    pageNumber: number,
    pageSize: number,
    concepto?: string,
    tipMov?: string
  ): Observable<ConceptosResponse> {
    let params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    params = this.appendIfPresent(params, 'concepto', concepto);
    params = this.appendIfPresent(params, 'tipMov', tipMov);

    return this.http.get<ConceptosResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        totalRegistros: response?.totalRegistros ?? 0,
        data: response?.data ?? []
      })),
      catchError((error) => this.handleError(error, 'No se pudieron cargar los conceptos bancarios.'))
    );
  }

  createConcepto(payload: Pick<Concepto, 'codConcepto' | 'concepto' | 'tipMov' | 'empresa' | 'operador'>): Observable<Concepto> {
    return this.http.post<Concepto>(this.apiUrl, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo crear el concepto bancario.'))
    );
  }

  updateConcepto(
    codConcepto: string,
    payload: Pick<Concepto, 'codConcepto' | 'concepto' | 'tipMov' | 'empresa' | 'operador'>
  ): Observable<Concepto> {
    const url = `${this.apiUrl}/${encodeURIComponent(codConcepto)}`;
    return this.http.put<Concepto>(url, payload).pipe(
      catchError((error) => this.handleError(error, 'No se pudo actualizar el concepto bancario.'))
    );
  }

  deleteConcepto(codConcepto: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(codConcepto)}`;
    return this.http.delete<void>(url).pipe(
      catchError((error) => this.handleError(error, 'No se pudo eliminar el concepto bancario.'))
    );
  }

  private appendIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = value?.trim();
    return normalized ? params.set(key, normalized) : params;
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
