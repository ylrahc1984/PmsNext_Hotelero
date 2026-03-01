import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { CompraFacturaResponse } from './interfaces/CompraFacturaResponse.interface';

export interface CompraFacturaFilters {
  fechaInicio?: string;
  fechaFinal?: string;
  proveedor?: string;
  numeroFactura?: string;
  tipoDocumento?: string;
  pageNumber: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class RecepcionFacturasService {
  private readonly apiUrl = `${environment.apiUrl}/compras`;

  constructor(private http: HttpClient) {}

  getFacturas(filters: CompraFacturaFilters): Observable<CompraFacturaResponse> {
    let params = new HttpParams()
      .set('PageNumber', filters.pageNumber.toString())
      .set('PageSize', filters.pageSize.toString());

    params = this.appendIfValue(params, 'fechaInicio', filters.fechaInicio);
    params = this.appendIfValue(params, 'fechaFinal', filters.fechaFinal);
    params = this.appendIfValue(params, 'proveedor', filters.proveedor);
    params = this.appendIfValue(params, 'numeroFactura', filters.numeroFactura);
    params = this.appendIfValue(params, 'tipoDocumento', filters.tipoDocumento);

    return this.http.get<CompraFacturaResponse>(this.apiUrl, { params });
  }

  private appendIfValue(params: HttpParams, key: string, value?: string): HttpParams {
    if (!value) {
      return params;
    }
    const trimmed = value.trim();
    return trimmed ? params.set(key, trimmed) : params;
  }
}
