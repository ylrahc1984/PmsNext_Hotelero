import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ComercialReportFilters, ComercialReportResponse } from './comercial-report.models';

@Injectable({ providedIn: 'root' })
export class ComercialReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  getReport(filters: ComercialReportFilters): Observable<ComercialReportResponse> {
    const params = new HttpParams()
      .set('fechaDesde', this.toApiDate(filters.fechaDesde))
      .set('fechaHasta', this.toApiDate(filters.fechaHasta))
      .set('moneda', filters.moneda);

    return this.http.get<ComercialReportResponse>(`${this.baseUrl}/reportes/comercial`, { params });
  }

  private toApiDate(value: string): string {
    const match = (value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }
}
