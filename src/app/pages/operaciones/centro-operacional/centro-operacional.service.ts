import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { CentroOperacionalParams, CentroOperacionalResponse } from './interfaces/centro-operacional.interface';

@Injectable({ providedIn: 'root' })
export class CentroOperacionalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  getCentroOperacional(params: CentroOperacionalParams): Observable<CentroOperacionalResponse> {
    let httpParams = new HttpParams();
    const fechaInicio = this.toBackendDate(params.fechaInicio);
    const fechaFin = this.toBackendDate(params.fechaFin);
    const busqueda = (params.busqueda ?? '').toString().trim();
    const agenciaId = (params.agenciaId ?? '').toString().trim();
    const choferId = (params.choferId ?? '').toString().trim();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 1000;

    if (fechaInicio) httpParams = httpParams.set('fechaInicio', fechaInicio);
    if (fechaFin) httpParams = httpParams.set('fechaFin', fechaFin);
    if (busqueda) httpParams = httpParams.set('busqueda', busqueda);
    if (agenciaId) httpParams = httpParams.set('agenciaId', agenciaId);
    if (choferId) httpParams = httpParams.set('choferId', choferId);

    httpParams = httpParams.set('page', page.toString()).set('pageSize', pageSize.toString());

    return this.http.get<CentroOperacionalResponse>(`${this.baseUrl}/reportes/operacion-diaria`, { params: httpParams });
  }

  private toBackendDate(value: string | null | undefined): string {
    const raw = (value ?? '').toString().trim();
    if (!raw) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;

    const isoMatch = raw.split('T')[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

    return raw;
  }
}
