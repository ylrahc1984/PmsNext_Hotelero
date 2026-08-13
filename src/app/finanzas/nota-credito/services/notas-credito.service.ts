import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  NotaCreditoDetalleResponse,
  NotaCreditoRequest,
  NotaCreditoResponse
} from 'src/app/finanzas/nota-credito/interfaces/notas-credito.interface';

@Injectable({ providedIn: 'root' })
export class NotasCreditoService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = this.resolveApiBaseUrl();
  private readonly baseUrl = `${this.apiBaseUrl}/notas-credito`;
  private readonly consultaUrl = `${this.baseUrl}/consultar/95`;

  consultarNotasCredito(
    tipNC: string,
    fecha: string,
    fechaFin: string,
    page: number,
    pageSize: number,
    filtro?: string
  ): Observable<NotaCreditoResponse> {
    let params = new HttpParams()
      .set('TipNC', (tipNC ?? '').toString().trim().toUpperCase())
      .set('Fecha', fecha)
      .set('FechaFin', fechaFin)
      .set('Page', String(page))
      .set('PageSize', String(pageSize));

    const normalized = filtro?.trim();
    if (normalized) {
      params = params.set('Filtro', normalized);
    }

    return this.http.get<NotaCreditoResponse>(this.consultaUrl, { params }).pipe(
      map((response) => ({
        datos: response?.datos ?? [],
        paginacion: {
          totalRegistros: response?.paginacion?.totalRegistros ?? 0,
          paginaActual: response?.paginacion?.paginaActual ?? page,
          pageSize: response?.paginacion?.pageSize ?? pageSize
        }
      })),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al consultar notas de crédito';
        return throwError(() => new Error(message));
      })
    );
  }

  crearNotaCredito(payload: NotaCreditoRequest): Observable<unknown> {
    console.groupCollapsed(`[NotasCredito] POST ${this.baseUrl}`);
    console.log('Endpoint:', this.baseUrl);
    console.log('Payload:', payload);
    console.log('Payload JSON:', JSON.stringify(payload, null, 2));
    console.groupEnd();

    return this.http.post(this.baseUrl, payload, { observe: 'response' }).pipe(
      tap((response) => {
        console.groupCollapsed(`[NotasCredito] Respuesta POST ${this.baseUrl}`);
        console.log('Status:', response.status, response.statusText);
        console.log('Body:', response.body);
        console.log('Headers:', response.headers.keys().reduce<Record<string, string | null>>((headers, key) => {
          headers[key] = response.headers.get(key);
          return headers;
        }, {}));
        console.groupEnd();
      }),
      map((response) => response.body),
      catchError((error: HttpErrorResponse) => {
        console.error(`[NotasCredito] Error POST ${this.baseUrl}`, {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          error: error.error,
          message: error.message
        });
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al crear la nota de crédito';
        return throwError(() => new Error(message));
      })
    );
  }

  getDetalleNotaCredito(tipo: string, serie: string, numero: string): Observable<NotaCreditoDetalleResponse> {
    const safeTipo = encodeURIComponent((tipo ?? '').toString().trim().toLowerCase());
    const safeSerie = encodeURIComponent((serie ?? '').toString().trim());
    const safeNumero = encodeURIComponent((numero ?? '').toString().trim());
    const url = `${this.apiBaseUrl}/notacredito-cliente/${safeTipo}/${safeSerie}/${safeNumero}`;

    return this.http.get<NotaCreditoDetalleResponse>(url).pipe(
      map((response) => response ?? {}),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al cargar el detalle de la nota de crédito';
        return throwError(() => new Error(message));
      })
    );
  }

  getNotaCreditoPdf(tipo: string, serie: string, numero: string): Observable<Blob> {
    const safeTipo = encodeURIComponent((tipo ?? '').toString().trim().toLowerCase());
    const safeSerie = encodeURIComponent((serie ?? '').toString().trim());
    const safeNumero = encodeURIComponent((numero ?? '').toString().trim());
    const url = `${this.baseUrl}/${safeTipo}/${safeSerie}/${safeNumero}/pdf`;

    return this.http.get(url, { responseType: 'blob' }).pipe(
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo generar el PDF de la nota de crédito';
        return throwError(() => new Error(message));
      })
    );
  }

  private resolveApiBaseUrl(): string {
    const rawBaseUrl = (environment.apiUrl || environment.baseUrl || '').toString().trim();
    return rawBaseUrl.replace(/\/+$/, '');
  }
}
