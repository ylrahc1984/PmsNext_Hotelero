import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { OperacionDiariaResponse } from './models/operacion-diaria.model';

export interface OperacionDiariaParams {
  fechaInicio: string;
  fechaFin: string;
  busqueda?: string;
  agenciaId?: string;
  choferId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class OperacionDiariaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  getOperacionDiaria(params: OperacionDiariaParams): Observable<OperacionDiariaResponse> {
    let httpParams = new HttpParams();

    const fechaInicio = (params.fechaInicio ?? '').toString().trim();
    const fechaFin = (params.fechaFin ?? '').toString().trim();
    const busqueda = (params.busqueda ?? '').toString().trim();
    const agenciaId = (params.agenciaId ?? '').toString().trim();
    const choferId = (params.choferId ?? '').toString().trim();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    if (fechaInicio) httpParams = httpParams.set('fechaInicio', fechaInicio);
    if (fechaFin) httpParams = httpParams.set('fechaFin', fechaFin);
    if (busqueda) httpParams = httpParams.set('busqueda', busqueda);
    if (agenciaId) httpParams = httpParams.set('agenciaId', agenciaId);
    if (choferId) httpParams = httpParams.set('choferId', choferId);
    httpParams = httpParams.set('page', page.toString()).set('pageSize', pageSize.toString());

    return this.http.get<OperacionDiariaResponse>(`${this.baseUrl}/reportes/operacion-diaria`, { params: httpParams });
  }
}
