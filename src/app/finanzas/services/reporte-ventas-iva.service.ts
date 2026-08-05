import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  EMPTY_REPORTE_VENTAS_IVA_RESUMEN,
  ReporteVentasIvaFiltros,
  ReporteVentasIvaResponse
} from '../reporte-ventas-iva/reporte-ventas-iva.interface';

@Injectable({ providedIn: 'root' })
export class ReporteVentasIvaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reporte-ventas-hotelero/documentos-y-nc`;

  obtenerDetalle(filtros: ReporteVentasIvaFiltros): Observable<ReporteVentasIvaResponse> {
    const params = new HttpParams()
      .set('fechaInicial', filtros.fechaInicial)
      .set('fechaFinal', filtros.fechaFinal)
      .set('moneda', filtros.moneda)
      .set('pntVenta', filtros.pntVenta);

    return this.http.get<ReporteVentasIvaResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        detalle: Array.isArray(response?.detalle) ? response.detalle : [],
        resumen: { ...EMPTY_REPORTE_VENTAS_IVA_RESUMEN, ...(response?.resumen ?? {}) }
      })),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje ||
          error.error?.respuesta ||
          error.message ||
          'Error al consultar los documentos y notas de credito';
        return throwError(() => new Error(message));
      })
    );
  }
}
