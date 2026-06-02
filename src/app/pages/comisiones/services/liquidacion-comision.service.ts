import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LiquidacionComision,
  LiquidacionComisionRequest,
  LiquidacionDetalleResponse,
  LiquidacionListFilters,
  LiquidacionResumen
} from '../interfaces/liquidacion-comision.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class LiquidacionComisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('liquidacion-comision');

  crear(payload: LiquidacionComision): Observable<LiquidacionComision> {
    return this.http.post<LiquidacionComision>(this.apiUrl, payload);
  }

  crearLiquidacion(request: LiquidacionComisionRequest): Observable<unknown> {
    return this.http.post<unknown>(this.apiUrl, request);
  }

  actualizarLiquidacion(id: string, request: LiquidacionComisionRequest): Observable<unknown> {
    return this.http.put<unknown>(`${this.apiUrl}/${encodeURIComponent(id)}`, request);
  }

  listarLiquidaciones(params?: LiquidacionListFilters): Observable<LiquidacionResumen[]> {
    const httpParams = toHttpParams(params as QueryParams);
    console.info('[LiquidacionComisionService] GET listarLiquidaciones', {
      url: this.apiUrl,
      params: httpParams.keys().reduce<Record<string, string>>((acc, key) => ({ ...acc, [key]: httpParams.get(key) ?? '' }), {}),
      requestUrl: `${this.apiUrl}?${httpParams.toString()}`
    });

    return this.http.get<LiquidacionResumen[]>(this.apiUrl, { params: httpParams });
  }

  obtenerLiquidacion(id: string): Observable<LiquidacionDetalleResponse> {
    return this.http.get<LiquidacionDetalleResponse>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  obtenerVoucher(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${encodeURIComponent(id)}/voucher`, {
      headers: { Accept: 'application/pdf' },
      responseType: 'blob'
    });
  }

  actualizar(id: number, payload: LiquidacionComision): Observable<LiquidacionComision> {
    return this.http.put<LiquidacionComision>(`${this.apiUrl}/${id}`, payload);
  }

  obtener(id: number | string): Observable<LiquidacionComision> {
    return this.http.get<LiquidacionComision>(`${this.apiUrl}/${id}`);
  }

  listar(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(this.apiUrl, { params: toHttpParams(params) });
  }

  existe(id: number | string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/existe`);
  }

  cerrar(id: number | string): Observable<void> {
    return this.cerrarLiquidacion(id);
  }

  cerrarLiquidacion(id: number | string, operador = ''): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${encodeURIComponent(String(id))}/cerrar`, {}, { params: toHttpParams({ operador }) });
  }

  pagar(id: number | string): Observable<void> {
    return this.pagarLiquidacion(id);
  }

  pagarLiquidacion(id: number | string, operador = ''): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${encodeURIComponent(String(id))}/pagar`, {}, { params: toHttpParams({ operador }) });
  }

  anular(id: number | string, payload: Record<string, unknown> = {}, operador = ''): Observable<void> {
    return this.anularLiquidacion(id, payload, operador);
  }

  anularLiquidacion(id: number | string, payload: Record<string, unknown> = {}, operador = ''): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${encodeURIComponent(String(id))}/anular`, payload, { params: toHttpParams({ operador }) });
  }

  borradores(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(`${this.apiUrl}/borradores`, { params: toHttpParams(params) });
  }

  pendientesPago(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(`${this.apiUrl}/pendientes-pago`, { params: toHttpParams(params) });
  }
}
