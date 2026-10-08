import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { ArribosResponse } from '../models/arribo.model';

@Injectable({ providedIn: 'root' })
export class ArribosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/frontdesk/arribos`;

  consultarArribos(fechaDesde: string, fechaHasta: string, codAgencia?: string): Observable<ArribosResponse> {
    let params = new HttpParams()
      .set('fechaDesde', normalizePmsDateDDMMYYYY(fechaDesde))
      .set('fechaHasta', normalizePmsDateDDMMYYYY(fechaHasta));

    const agencia = codAgencia?.trim();
    if (agencia) {
      params = params.set('codAgencia', agencia);
    }

    return this.http.get<ArribosResponse>(this.apiUrl, { params });
  }
}
