import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ReporteVentasIvaFiltros, ReporteVentasIvaRow } from '../reporte-ventas-iva/reporte-ventas-iva.interface';

type ReporteVentasIvaApiResponse =
  | ReporteVentasIvaRow[]
  | {
      detalle?: ReporteVentasIvaRow[];
      datos?: ReporteVentasIvaRow[];
      data?: ReporteVentasIvaRow[];
      items?: ReporteVentasIvaRow[];
    };

@Injectable({ providedIn: 'root' })
export class ReporteVentasIvaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ventas-totales-cliente-detallado`;

  obtenerDetalle(filtros: ReporteVentasIvaFiltros): Observable<ReporteVentasIvaRow[]> {
    const params = this.buildParams(filtros);

    return this.http.get<ReporteVentasIvaApiResponse>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeResponse(response)),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al consultar el reporte de ventas por IVA';
        return throwError(() => new Error(message));
      })
    );
  }

  exportarExcel(filtros: ReporteVentasIvaFiltros): Observable<HttpResponse<Blob>> {
    return this.http
      .get(`${this.apiUrl}/excel`, {
        params: this.buildParams(filtros),
        observe: 'response',
        responseType: 'blob'
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al exportar el reporte de ventas por IVA';
          return throwError(() => new Error(message));
        })
      );
  }

  private buildParams(filtros: ReporteVentasIvaFiltros): HttpParams {
    return new HttpParams()
      .set('Proceso', String(filtros.Proceso))
      .set('FechaInicial', filtros.FechaInicial)
      .set('FechaFinal', filtros.FechaFinal)
      .set('Moneda', filtros.Moneda);
  }

  private normalizeResponse(response: ReporteVentasIvaApiResponse): ReporteVentasIvaRow[] {
    if (Array.isArray(response)) {
      return response;
    }

    return response?.detalle ?? response?.datos ?? response?.data ?? response?.items ?? [];
  }
}
