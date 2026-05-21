import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ComisionLog } from '../interfaces/comision-log.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class ComisionLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('comision-log');

  crear(payload: ComisionLog): Observable<ComisionLog> {
    return this.http.post<ComisionLog>(this.apiUrl, payload);
  }

  obtener(id: number): Observable<ComisionLog> {
    return this.http.get<ComisionLog>(`${this.apiUrl}/${id}`);
  }

  listar(params?: QueryParams): Observable<ComisionLog[]> {
    return this.http.get<ComisionLog[]>(this.apiUrl, { params: toHttpParams(params) });
  }

  porTabla(tablaAfectada: string): Observable<ComisionLog[]> {
    return this.http.get<ComisionLog[]>(`${this.apiUrl}/tabla/${encodeURIComponent(tablaAfectada)}`);
  }

  porRegistro(tablaAfectada: string, registroId: number | string): Observable<ComisionLog[]> {
    return this.http.get<ComisionLog[]>(`${this.apiUrl}/registro/${encodeURIComponent(tablaAfectada)}/${registroId}`);
  }

  porOperador(operador: string): Observable<ComisionLog[]> {
    return this.http.get<ComisionLog[]>(`${this.apiUrl}/operador/${encodeURIComponent(operador)}`);
  }

  porFechas(params?: QueryParams): Observable<ComisionLog[]> {
    return this.http.get<ComisionLog[]>(`${this.apiUrl}/por-fechas`, { params: toHttpParams(params) });
  }
}
