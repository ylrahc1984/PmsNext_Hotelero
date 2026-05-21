import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ComisionCalculada } from '../interfaces/comision-calculada.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class ComisionCalculadaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('comision-calculada');

  crear(payload: ComisionCalculada): Observable<ComisionCalculada> {
    return this.http.post<ComisionCalculada>(this.apiUrl, payload);
  }

  cambiarEstado(id: number, estado: string): Observable<ComisionCalculada> {
    return this.http.patch<ComisionCalculada>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  obtener(id: number): Observable<ComisionCalculada> {
    return this.http.get<ComisionCalculada>(`${this.apiUrl}/${id}`);
  }

  listar(params?: QueryParams): Observable<ComisionCalculada[]> {
    return this.http.get<ComisionCalculada[]>(this.apiUrl, { params: toHttpParams(params) });
  }

  existe(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/existe`);
  }

  anular(id: number, payload: Record<string, unknown> = {}): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/anular`, payload);
  }

  pendientes(params?: QueryParams): Observable<ComisionCalculada[]> {
    return this.http.get<ComisionCalculada[]>(`${this.apiUrl}/pendientes`, { params: toHttpParams(params) });
  }

  liquidadas(params?: QueryParams): Observable<ComisionCalculada[]> {
    return this.http.get<ComisionCalculada[]>(`${this.apiUrl}/liquidadas`, { params: toHttpParams(params) });
  }

  porDocumento(params?: QueryParams): Observable<ComisionCalculada[]> {
    return this.http.get<ComisionCalculada[]>(`${this.apiUrl}/por-documento`, { params: toHttpParams(params) });
  }
}
