import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReglaComision, ReglaComisionPayload, ReglaComisionResponse } from '../interfaces/regla-comision.interface';
import { asArray } from '../shared/models/comisiones-normalizers';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

type ReglaApi = Partial<ReglaComision> & Record<string, unknown>;
type ListResponse = ReglaApi[] | { datos?: ReglaApi[]; data?: ReglaApi[]; items?: ReglaApi[] };
type ExistsResponse = boolean | number | string | null | undefined | { existe?: ExistsResponse; data?: ExistsResponse; datos?: ExistsResponse; respuesta?: ExistsResponse };

@Injectable({ providedIn: 'root' })
export class ReglaComisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('regla-comision');

  create(payload: ReglaComisionPayload): Observable<ReglaComisionResponse> {
    return this.http.post<ReglaComisionResponse>(this.apiUrl, payload);
  }

  update(id: number, payload: ReglaComisionPayload): Observable<ReglaComisionResponse> {
    return this.http.put<ReglaComisionResponse>(`${this.apiUrl}/${id}`, payload);
  }

  getById(id: number): Observable<ReglaComision> {
    return this.http.get<ReglaApi>(`${this.apiUrl}/${id}`).pipe(map((response) => this.normalizeRegla(response)));
  }

  list(params?: QueryParams): Observable<ReglaComision[]> {
    return this.http
      .get<ListResponse>(this.apiUrl, { params: toHttpParams(params) })
      .pipe(map((response) => asArray(response).map((item) => this.normalizeRegla(item))));
  }

  activate(id: number, operador = ''): Observable<ReglaComisionResponse> {
    return this.http.patch<ReglaComisionResponse>(`${this.apiUrl}/${id}/activar`, {}, { params: toHttpParams({ operador }) });
  }

  deactivate(id: number, operador = ''): Observable<ReglaComisionResponse> {
    return this.http.patch<ReglaComisionResponse>(`${this.apiUrl}/${id}/desactivar`, {}, { params: toHttpParams({ operador }) });
  }

  exists(id: number): Observable<boolean> {
    return this.http.get<ExistsResponse>(`${this.apiUrl}/${id}/existe`).pipe(map((response) => this.normalizeExists(response)));
  }

  getReglaVigente(params?: QueryParams): Observable<ReglaComision | null> {
    return this.http.get<ReglaApi | ListResponse>(`${this.apiUrl}/vigente`, { params: toHttpParams(params) }).pipe(
      map((response) => {
        const item = Array.isArray(response) || this.isListEnvelope(response) ? asArray(response as ListResponse)[0] : (response as ReglaApi);
        return item ? this.normalizeRegla(item) : null;
      })
    );
  }

  crear(payload: ReglaComisionPayload): Observable<ReglaComisionResponse> {
    return this.create(payload);
  }

  actualizar(id: number, payload: ReglaComisionPayload): Observable<ReglaComisionResponse> {
    return this.update(id, payload);
  }

  obtener(id: number): Observable<ReglaComision> {
    return this.getById(id);
  }

  listar(params?: QueryParams): Observable<ReglaComision[]> {
    return this.list(params);
  }

  activar(id: number, operador = ''): Observable<ReglaComisionResponse> {
    return this.activate(id, operador);
  }

  desactivar(id: number, operador = ''): Observable<ReglaComisionResponse> {
    return this.deactivate(id, operador);
  }

  existe(id: number): Observable<boolean> {
    return this.exists(id);
  }

  vigente(params?: QueryParams): Observable<ReglaComision | null> {
    return this.getReglaVigente(params);
  }

  private normalizeRegla(item: ReglaApi): ReglaComision {
    return {
      AD17_Id: this.readNumber(item, ['AD17_Id', 'aD17_Id']),
      AD17_EmpresaId: this.readNumber(item, ['AD17_EmpresaId', 'aD17_EmpresaId']),
      AD17_CodAgencia: this.readText(item, ['AD17_CodAgencia', 'aD17_CodAgencia']),
      AD17_CodServicio: this.readText(item, ['AD17_CodServicio', 'aD17_CodServicio']),
      AD17_TipPax: this.readText(item, ['AD17_TipPax', 'aD17_TipPax']),
      AD17_TipoComision: this.readText(item, ['AD17_TipoComision', 'aD17_TipoComision'], 'PORCENTAJE'),
      AD17_ValorComision: this.readNumber(item, ['AD17_ValorComision', 'aD17_ValorComision']),
      AD17_Prioridad: this.readNumber(item, ['AD17_Prioridad', 'aD17_Prioridad']),
      AD17_FechaInicio: this.toDateOnly(this.readText(item, ['AD17_FechaInicio', 'aD17_FechaInicio'])),
      AD17_FechaFin: this.toDateOnly(this.readText(item, ['AD17_FechaFin', 'aD17_FechaFin'])),
      AD17_Activo: this.readBoolean(item, ['AD17_Activo', 'aD17_Activo'], true),
      AD17_Observaciones: this.readText(item, ['AD17_Observaciones', 'aD17_Observaciones'], ''),
      AD17_Operador: this.readText(item, ['AD17_Operador', 'aD17_Operador'], ''),
      AD17_FechaRegistro: this.toDateOnly(this.readText(item, ['AD17_FechaRegistro', 'aD17_FechaRegistro'], ''))
    };
  }

  private normalizeExists(response: ExistsResponse): boolean {
    if (typeof response === 'boolean') return response;
    if (typeof response === 'number') return response === 1;
    if (typeof response === 'string') {
      const value = response.trim().toLowerCase();
      return value === 'true' || value === '1' || value === 'si' || value === 'sí' || (value.includes('existe') && !value.includes('no existe'));
    }
    if (response && typeof response === 'object') {
      const record = response as Record<string, ExistsResponse>;
      return this.normalizeExists(record['existe'] ?? record['data'] ?? record['datos'] ?? record['respuesta']);
    }
    return false;
  }

  private isListEnvelope(response: unknown): response is { datos?: ReglaApi[]; data?: ReglaApi[]; items?: ReglaApi[] } {
    return !!response && typeof response === 'object' && ('datos' in response || 'data' in response || 'items' in response);
  }

  private readText(item: ReglaApi, keys: string[], fallback = ''): string {
    return String(this.readValue(item, keys, fallback) ?? fallback).trim();
  }

  private readNumber(item: ReglaApi, keys: string[], fallback = 0): number {
    const value = Number(this.readValue(item, keys, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  private readBoolean(item: ReglaApi, keys: string[], fallback = false): boolean {
    const value = this.readValue(item, keys, fallback);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['true', '1', 'si', 'sí', 's', 'activo'].includes(String(value ?? '').trim().toLowerCase());
  }

  private readValue(item: ReglaApi, keys: string[], fallback: unknown): unknown {
    for (const key of keys) {
      const value = item[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return fallback;
  }

  private toDateOnly(value: string): string {
    return value.includes('T') ? value.slice(0, 10) : value;
  }
}
