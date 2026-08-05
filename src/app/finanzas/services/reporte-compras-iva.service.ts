import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ReporteComprasIvaFiltros, ReporteComprasIvaRow } from '../reporte-compras-iva/reporte-compras-iva.interface';

type ReporteComprasIvaApiResponse =
  | ReporteComprasIvaRow[]
  | { detalle?: ReporteComprasIvaRow[]; datos?: ReporteComprasIvaRow[]; data?: ReporteComprasIvaRow[]; items?: ReporteComprasIvaRow[] };

@Injectable({ providedIn: 'root' })
export class ReporteComprasIvaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/contabilidad/compras-contables/consultar`;

  obtenerDetalle(filtros: ReporteComprasIvaFiltros): Observable<ReporteComprasIvaRow[]> {
    return this.http.post<ReporteComprasIvaApiResponse>(this.apiUrl, filtros).pipe(
      map((response) => Array.isArray(response)
        ? response
        : response?.detalle ?? response?.datos ?? response?.data ?? response?.items ?? []),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al consultar el reporte de compras por IVA';
        return throwError(() => new Error(message));
      })
    );
  }
}
