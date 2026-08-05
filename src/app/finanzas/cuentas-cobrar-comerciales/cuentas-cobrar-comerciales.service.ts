import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { CuentasCobrarComercialesQuery, CuentasCobrarComercialesResponse } from './interfaces';

@Injectable({ providedIn: 'root' })
export class CuentasCobrarComercialesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/contabilidad/estado-cuenta-ndp`;

  consultar(query: CuentasCobrarComercialesQuery): Observable<CuentasCobrarComercialesResponse> {
    const params = new HttpParams()
      .set('fechaInicial', query.fechaInicial)
      .set('fechaFinal', query.fechaFinal)
      .set('pageNumber', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    return this.http.get<CuentasCobrarComercialesResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        datos: Array.isArray(response?.datos) ? response.datos : [],
        paginacion: {
          totalRegistros: Number(response?.paginacion?.totalRegistros) || 0,
          paginaActual: Number(response?.paginacion?.paginaActual) || query.pageNumber,
          pageSize: Number(response?.paginacion?.pageSize) || query.pageSize
        }
      }))
    );
  }
}
