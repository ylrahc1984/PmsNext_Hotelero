import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ForecastActividadesResponse } from './models/forecast-actividades.model';

export interface ForecastActividadesParams {
  fechaInicio: string;
  fechaFin: string;
  busqueda?: string;
  agenciaId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ForecastActividadesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  getForecastActividades(params: ForecastActividadesParams): Observable<ForecastActividadesResponse> {
    let httpParams = new HttpParams();

    const fechaInicio = this.toBackendDate(params.fechaInicio);
    const fechaFin = this.toBackendDate(params.fechaFin);
    const busqueda = (params.busqueda ?? '').toString().trim();
    const agenciaId = (params.agenciaId ?? '').toString().trim();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 500;

    if (fechaInicio) httpParams = httpParams.set('fechaInicio', fechaInicio);
    if (fechaFin) httpParams = httpParams.set('fechaFin', fechaFin);
    if (busqueda) httpParams = httpParams.set('busqueda', busqueda);
    if (agenciaId) httpParams = httpParams.set('agenciaId', agenciaId);
    httpParams = httpParams.set('page', page.toString());
    httpParams = httpParams.set('pageSize', pageSize.toString());

    return this.http.get<ForecastActividadesResponse>(`${this.baseUrl}/reportes/operacion-diaria`, { params: httpParams });
  }

  private toBackendDate(value: string | null | undefined): string {
    const raw = (value ?? '').toString().trim();
    if (!raw) return '';

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }

    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
    }

    const isoDate = raw.split('T')[0];
    const isoMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    const day = `${parsed.getDate()}`.padStart(2, '0');
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
