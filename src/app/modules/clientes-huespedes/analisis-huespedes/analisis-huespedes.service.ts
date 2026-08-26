import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { toGuestApiDate } from './analisis-huespedes.helpers';
import { ReporteHuespedMercadeo } from './analisis-huespedes.models';

@Injectable({ providedIn: 'root' })
export class AnalisisHuespedesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/reporte-huespedes-mercadeo`;

  getReporteHuespedesMercadeo(fechaDesde: string, fechaHasta: string): Observable<ReporteHuespedMercadeo[]> {
    const params = new HttpParams().set('FechaDesde', toGuestApiDate(fechaDesde)).set('FechaHasta', toGuestApiDate(fechaHasta));

    return this.http.get<ReporteHuespedMercadeo[]>(this.apiUrl, { params });
  }
}
