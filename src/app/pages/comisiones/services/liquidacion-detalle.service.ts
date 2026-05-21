import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LiquidacionDetalle, LiquidacionTotales } from '../interfaces/liquidacion-comision.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class LiquidacionDetalleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('liquidacion-comision-detalle');

  crear(payload: LiquidacionDetalle): Observable<LiquidacionDetalle> {
    return this.http.post<LiquidacionDetalle>(this.apiUrl, payload);
  }

  obtener(id: number): Observable<LiquidacionDetalle> {
    return this.http.get<LiquidacionDetalle>(`${this.apiUrl}/${id}`);
  }

  porLiquidacion(liquidacionId: number): Observable<LiquidacionDetalle[]> {
    return this.http.get<LiquidacionDetalle[]>(`${this.apiUrl}/liquidacion/${liquidacionId}`);
  }

  existe(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/existe`);
  }

  porDocumento(params?: QueryParams): Observable<LiquidacionDetalle[]> {
    return this.http.get<LiquidacionDetalle[]>(`${this.apiUrl}/por-documento`, { params: toHttpParams(params) });
  }

  totales(liquidacionId: number): Observable<LiquidacionTotales> {
    return this.http.get<LiquidacionTotales>(`${this.apiUrl}/liquidacion/${liquidacionId}/totales`);
  }

  yaLiquidada(comisionCalculadaId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/comision/${comisionCalculadaId}/ya-liquidada`);
  }
}
