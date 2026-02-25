import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { NotaCreditoRequest, NotaCreditoResponse } from 'src/app/finanzas/nota-credito/interfaces/notas-credito.interface';

@Injectable({ providedIn: 'root' })
export class NotasCreditoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/notas-credito`;
  private readonly consultaUrl = `${this.baseUrl}/consultar/95`;

  consultarNotasCredito(
    fecha: string,
    fechaFin: string,
    page: number,
    pageSize: number,
    filtro?: string
  ): Observable<NotaCreditoResponse> {
    let params = new HttpParams()
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
    return this.http.post(this.baseUrl, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al crear la nota de crédito';
        return throwError(() => new Error(message));
      })
    );
  }
}
