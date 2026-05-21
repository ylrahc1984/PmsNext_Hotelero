import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LiquidacionComision } from '../interfaces/liquidacion-comision.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class LiquidacionComisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('liquidacion-comision');

  crear(payload: LiquidacionComision): Observable<LiquidacionComision> {
    return this.http.post<LiquidacionComision>(this.apiUrl, payload);
  }

  actualizar(id: number, payload: LiquidacionComision): Observable<LiquidacionComision> {
    return this.http.put<LiquidacionComision>(`${this.apiUrl}/${id}`, payload);
  }

  obtener(id: number): Observable<LiquidacionComision> {
    return this.http.get<LiquidacionComision>(`${this.apiUrl}/${id}`);
  }

  listar(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(this.apiUrl, { params: toHttpParams(params) });
  }

  existe(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/existe`);
  }

  cerrar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/cerrar`, {});
  }

  pagar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/pagar`, {});
  }

  anular(id: number, payload: Record<string, unknown> = {}): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/anular`, payload);
  }

  borradores(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(`${this.apiUrl}/borradores`, { params: toHttpParams(params) });
  }

  pendientesPago(params?: QueryParams): Observable<LiquidacionComision[]> {
    return this.http.get<LiquidacionComision[]>(`${this.apiUrl}/pendientes-pago`, { params: toHttpParams(params) });
  }
}
