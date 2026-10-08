import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { ProduccionAgenciaFilters, ProduccionAgenciaResponse } from './produccion-agencia.models';

@Injectable({ providedIn: 'root' })
export class ProduccionAgenciaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes/produccion-agencia`;

  consultar(filters: ProduccionAgenciaFilters): Observable<ProduccionAgenciaResponse> {
    const params = new HttpParams()
      .set('fechaInicio', normalizePmsDateDDMMYYYY(filters.fechaInicio))
      .set('fechaFin', normalizePmsDateDDMMYYYY(filters.fechaFin));

    return this.http.get<ProduccionAgenciaResponse>(this.apiUrl, { params });
  }
}
