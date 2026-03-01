import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { EstadoCuentaQuery, EstadoCuentaResponse } from './interfaces';

@Injectable({ providedIn: 'root' })
export class EstadoCuentaService {
  private readonly apiUrl = `${environment.apiUrl}/estado-cuenta-cliente`;

  constructor(private http: HttpClient) {}

  consultarEstadoCuenta(query: EstadoCuentaQuery): Observable<EstadoCuentaResponse> {
    let params = new HttpParams()
      .set('FechaInicial', query.fechaInicial)
      .set('FechaFinal', query.fechaFinal)
      .set('CodCliente', query.codCliente || '')
      .set('EstDocu', query.estadoDocumento || '')
      .set('pageNumber', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    return this.http.get<EstadoCuentaResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        data: response?.data ?? [],
        pageNumber: response?.pageNumber ?? query.pageNumber,
        pageSize: response?.pageSize ?? query.pageSize,
        totalRecords: response?.totalRecords ?? 0
      }))
    );
  }
}
