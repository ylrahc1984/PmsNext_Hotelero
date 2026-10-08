import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { OcupacionDiariaFilters, OcupacionDiariaResponse } from '../models/ocupacion-diaria.model';

@Injectable({ providedIn: 'root' })
export class OcupacionDiariaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/frontdesk/ocupacion-diaria`;

  consultar(filters: OcupacionDiariaFilters): Observable<OcupacionDiariaResponse> {
    let params = new HttpParams()
      .set('fecha', normalizePmsDateDDMMYYYY(filters.fecha))
      .set('soloActivas', String(filters.soloActivas));

    if (filters.cateHab.trim()) {
      params = params.set('cateHab', filters.cateHab.trim());
    }
    if (filters.codGrp.trim()) {
      params = params.set('codGrp', filters.codGrp.trim());
    }

    return this.http.get<OcupacionDiariaResponse>(this.apiUrl, { params });
  }
}
