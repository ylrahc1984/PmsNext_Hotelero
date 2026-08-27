import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { FinancialReportCurrency, ReporteFinancieroResponse } from './financial-report.models';

@Injectable({ providedIn: 'root' })
export class FinancialReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = String(environment.apiUrl ?? '').replace(/\/+$/, '');

  getReporteFinanciero(
    fechaDesde: Date,
    fechaHasta: Date,
    moneda: FinancialReportCurrency
  ): Observable<ReporteFinancieroResponse> {
    const params = new HttpParams()
      .set('fechaDesde', normalizePmsDateDDMMYYYY(fechaDesde))
      .set('fechaHasta', normalizePmsDateDDMMYYYY(fechaHasta))
      .set('moneda', moneda);

    return this.http.get<ReporteFinancieroResponse>(`${this.baseUrl}/reportes/financiero`, { params }).pipe(
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje ||
          error.error?.respuesta ||
          error.error?.message ||
          error.message ||
          'No fue posible cargar el reporte financiero.';
        return throwError(() => new Error(message));
      })
    );
  }
}
