import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { EstadoCuentaQuery, EstadoCuentaResponse } from './interfaces';

@Injectable({ providedIn: 'root' })
export class EstadoCuentaService {
  private readonly apiUrl = `${environment.apiUrl}/estado-cuenta-cliente`;

  constructor(private http: HttpClient) {}

  consultarEstadoCuenta(query: EstadoCuentaQuery): Observable<EstadoCuentaResponse> {
    const params = this.buildParams(query);

    return this.http.get<EstadoCuentaResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        data: response?.data ?? [],
        pageNumber: response?.pageNumber ?? query.pageNumber,
        pageSize: response?.pageSize ?? query.pageSize,
        totalRecords: response?.totalRecords ?? 0
      }))
    );
  }

  exportarExcel(query: EstadoCuentaQuery): Observable<HttpResponse<Blob>> {
    const params = this.buildParams({
      ...query,
      pageNumber: 1,
      pageSize: 1000
    }).set('Proceso', '1');

    return this.http.get(`${this.apiUrl}/exportar-excel`, {
      params,
      observe: 'response',
      responseType: 'blob'
    });
  }

  private buildParams(query: EstadoCuentaQuery): HttpParams {
    return new HttpParams()
      .set('FechaInicial', query.fechaInicial)
      .set('FechaFinal', query.fechaFinal)
      .set('CodCliente', query.codCliente || '')
      .set('EstDocu', query.estadoDocumento || '')
      .set('PageNumber', String(query.pageNumber))
      .set('PageSize', String(query.pageSize));
  }
}
