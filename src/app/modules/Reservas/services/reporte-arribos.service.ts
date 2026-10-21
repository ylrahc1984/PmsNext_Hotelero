import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ReporteArribosParams, ReporteArribosResponse } from '../models/reporte-arribos.model';

@Injectable({ providedIn: 'root' })
export class ReporteArribosService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/reporte-arrivos`;

  consultar(params: ReporteArribosParams): Observable<ReporteArribosResponse> {
    let httpParams = new HttpParams().set('fechaIngreso', params.fechaIngreso).set('fechaSalida', params.fechaSalida);
    if (params.operador?.trim()) {
      httpParams = httpParams.set('operador', params.operador.trim());
    }

    return this.http.get<ReporteArribosResponse>(this.endpoint, { params: httpParams });
  }
}
