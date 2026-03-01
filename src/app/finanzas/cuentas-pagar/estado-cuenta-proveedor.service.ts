import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface EstadoCuentaProveedorItem {
  tipDocPrv: string;
  serie: string;
  numFactura: string;
  fecFactu: string;
  fecVen: string;
  fecha: string;
  codProve: string;
  rucProve: string;
  nomProve: string;
  totalDocu: number;
  totPagado: number;
  saldo: number;
  moneda: string;
  estado: string;
  tCambio: number;
  totDeta: number;
  neto: number;
  exento: number;
  subTotal: number;
  impuesto: number;
  operador: string;
  tipDocu: string;
  numDocu: string;
}

export interface EstadoCuentaProveedorTotales {
  totDocu: number;
  totPago: number;
  saldo: number;
  moneda: string;
}

export interface EstadoCuentaProveedorResponse {
  datos: EstadoCuentaProveedorItem[];
  totalRegistros: number;
  pageNumber: number;
  pageSize: number;
  totales?: EstadoCuentaProveedorTotales[];
}

export interface EstadoCuentaProveedorFilters {
  fechaInicial: string;
  fechaFinal: string;
  pageNumber: number;
  pageSize: number;
  tipDocPrv?: string;
  codProve?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EstadoCuentaProveedorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/estado-cuenta-proveedor`;

  getEstadoCuentaProveedor(filters: EstadoCuentaProveedorFilters): Observable<EstadoCuentaProveedorResponse> {
    let params = new HttpParams()
      .set('fechaInicial', this.formatDate(filters.fechaInicial))
      .set('fechaFinal', this.formatDate(filters.fechaFinal))
      .set('pageNumber', String(filters.pageNumber))
      .set('pageSize', String(filters.pageSize));

    params = this.appendIfPresent(params, 'tipDocPrv', filters.tipDocPrv);
    params = this.appendIfPresent(params, 'codProve', filters.codProve);

    return this.http.get<EstadoCuentaProveedorResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        datos: response?.datos ?? [],
        totalRegistros: response?.totalRegistros ?? 0,
        pageNumber: response?.pageNumber ?? filters.pageNumber,
        pageSize: response?.pageSize ?? filters.pageSize,
        totales: response?.totales ?? []
      })),
      catchError((error) => this.handleError(error, 'No se pudo cargar el estado de cuenta de proveedores.'))
    );
  }

  private appendIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = value?.trim();
    return normalized ? params.set(key, normalized) : params;
  }

  private formatDate(value: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return trimmed;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return trimmed;
    }
    return `${day}/${month}/${year}`;
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    const message = this.getErrorMessage(error, fallback);
    return throwError(() => new Error(message));
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = (error.error && (error.error.mensaje || error.error.respuesta || error.error.message)) as
      | string
      | undefined;
    return apiMessage || error.message || fallback;
  }
}
