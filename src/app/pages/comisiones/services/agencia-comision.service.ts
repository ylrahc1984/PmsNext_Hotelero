import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AgenciaComision, AgenciaComisionPayload, AgenciaComisionResponse } from '../interfaces/config-comision.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';
import { asArray } from '../shared/models/comisiones-normalizers';

type AgenciaComisionApi = Partial<AgenciaComision> & Record<string, unknown>;

type ExisteAgenciaResponse =
  | boolean
  | number
  | string
  | null
  | undefined
  | {
      existe?: ExisteAgenciaResponse;
      exists?: ExisteAgenciaResponse;
      data?: ExisteAgenciaResponse;
      datos?: ExisteAgenciaResponse;
      resultado?: ExisteAgenciaResponse;
      respuesta?: ExisteAgenciaResponse;
      valor?: ExisteAgenciaResponse;
    };

@Injectable({ providedIn: 'root' })
export class AgenciaComisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('agencia-comision');

  create(payload: AgenciaComisionPayload): Observable<AgenciaComisionResponse> {
    return this.http.post<AgenciaComisionResponse>(this.apiUrl, payload);
  }

  update(id: number, payload: AgenciaComisionPayload): Observable<AgenciaComisionResponse> {
    return this.http.put<AgenciaComisionResponse>(`${this.apiUrl}/${id}`, payload);
  }

  getById(id: number): Observable<AgenciaComision> {
    return this.http.get<AgenciaComisionApi>(`${this.apiUrl}/${id}`).pipe(map((response) => this.normalizeAgencia(response)));
  }

  list(empresaId: number): Observable<AgenciaComision[]> {
    return this.http
      .get<AgenciaComisionApi[] | { datos?: AgenciaComisionApi[]; data?: AgenciaComisionApi[]; items?: AgenciaComisionApi[] }>(this.apiUrl, {
        params: toHttpParams({ empresaId })
      })
      .pipe(map((response) => asArray(response).map((item) => this.normalizeAgencia(item))));
  }

  activate(id: number, operador: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/activar`, {}, { params: toHttpParams({ operador }) });
  }

  deactivate(id: number, operador: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/desactivar`, {}, { params: toHttpParams({ operador }) });
  }

  exists(empresaId: number, codAgencia: string): Observable<boolean> {
    return this.http
      .get<ExisteAgenciaResponse>(`${this.apiUrl}/existe`, { params: toHttpParams({ empresaId, codAgencia }) })
      .pipe(map((response) => this.normalizeExistsResponse(response)));
  }

  crear(payload: AgenciaComisionPayload): Observable<AgenciaComisionResponse> {
    return this.create(payload);
  }

  actualizar(id: number, payload: AgenciaComisionPayload): Observable<AgenciaComisionResponse> {
    return this.update(id, payload);
  }

  obtener(id: number): Observable<AgenciaComision> {
    return this.getById(id);
  }

  listar(params?: QueryParams): Observable<AgenciaComision[]> {
    return this.http
      .get<AgenciaComisionApi[] | { datos?: AgenciaComisionApi[]; data?: AgenciaComisionApi[]; items?: AgenciaComisionApi[] }>(this.apiUrl, {
        params: toHttpParams(params)
      })
      .pipe(map((response) => asArray(response).map((item) => this.normalizeAgencia(item))));
  }

  activar(id: number, operador = ''): Observable<void> {
    return this.activate(id, operador);
  }

  desactivar(id: number, operador = ''): Observable<void> {
    return this.deactivate(id, operador);
  }

  existe(params?: QueryParams): Observable<boolean> {
    return this.http
      .get<ExisteAgenciaResponse>(`${this.apiUrl}/existe`, { params: toHttpParams(params) })
      .pipe(map((response) => this.normalizeExistsResponse(response)));
  }

  private normalizeExistsResponse(response: ExisteAgenciaResponse): boolean {
    if (typeof response === 'boolean') {
      return response;
    }

    if (typeof response === 'number') {
      return response === 1;
    }

    if (typeof response === 'string') {
      return this.parseBooleanResponse(response);
    }

    if (response && typeof response === 'object') {
      const keys: Array<keyof typeof response> = ['existe', 'exists', 'data', 'datos', 'resultado', 'respuesta', 'valor'];
      const key = keys.find((item) => item in response);

      if (key) {
        return this.normalizeExistsResponse(response[key]);
      }
    }

    return false;
  }

  private parseBooleanResponse(value: string): boolean {
    const normalized = value.trim().toLowerCase();

    if (!normalized || normalized === 'false' || normalized === '0' || normalized === 'no' || normalized.includes('no existe')) {
      return false;
    }

    return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí' || normalized.includes('existe');
  }

  private normalizeAgencia(item: AgenciaComisionApi): AgenciaComision {
    return {
      aD15_Id: this.readNumber(item, ['aD15_Id', 'AD15_Id']),
      aD15_EmpresaId: this.readNumber(item, ['aD15_EmpresaId', 'AD15_EmpresaId']),
      aD15_CodAgencia: this.readText(item, ['aD15_CodAgencia', 'AD15_CodAgencia']),
      MPV00_NomClien: this.readText(item, ['MPV00_NomClien'], ''),
      aD15_Comisiona: this.readBoolean(item, ['aD15_Comisiona', 'AD15_Comisiona']),
      aD15_TipoComisionDefault: this.readText(item, ['aD15_TipoComisionDefault', 'AD15_TipoComisionDefault'], 'PORCENTAJE'),
      aD15_ValorDefault: this.readNumber(item, ['aD15_ValorDefault', 'AD15_ValorDefault']),
      aD15_FechaInicio: this.toDateOnly(this.readText(item, ['aD15_FechaInicio', 'AD15_FechaInicio'])),
      aD15_FechaFin: this.toDateOnly(this.readText(item, ['aD15_FechaFin', 'AD15_FechaFin'])),
      aD15_Activo: this.readBoolean(item, ['aD15_Activo', 'AD15_Activo'], true),
      aD15_Observaciones: this.readText(item, ['aD15_Observaciones', 'AD15_Observaciones'], ''),
      aD15_Operador: this.readText(item, ['aD15_Operador', 'AD15_Operador'], '')
    };
  }

  private readText(item: AgenciaComisionApi, keys: string[], fallback = ''): string {
    const value = this.readValue(item, keys, fallback);
    return String(value ?? fallback).trim();
  }

  private readNumber(item: AgenciaComisionApi, keys: string[], fallback = 0): number {
    const value = Number(this.readValue(item, keys, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  private readBoolean(item: AgenciaComisionApi, keys: string[], fallback = false): boolean {
    const value = this.readValue(item, keys, fallback);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', '1', 'si', 'sí', 's', 'activo'].includes(normalized);
  }

  private readValue(item: AgenciaComisionApi, keys: string[], fallback: unknown): unknown {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }

    return fallback;
  }

  private toDateOnly(value: string): string {
    return value.includes('T') ? value.slice(0, 10) : value;
  }
}
