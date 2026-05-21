import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ServicioComisionable,
  ServicioComisionablePayload,
  ServicioComisionableResponse
} from '../interfaces/config-comision.interface';
import { asArray } from '../shared/models/comisiones-normalizers';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

type ServicioComisionableApi = Partial<ServicioComisionable> & Record<string, unknown>;
type ListResponse = ServicioComisionableApi[] | { datos?: ServicioComisionableApi[]; data?: ServicioComisionableApi[]; items?: ServicioComisionableApi[] };
type ExistsResponse =
  | boolean
  | number
  | string
  | null
  | undefined
  | {
      existe?: ExistsResponse;
      exists?: ExistsResponse;
      data?: ExistsResponse;
      datos?: ExistsResponse;
      resultado?: ExistsResponse;
      respuesta?: ExistsResponse;
      valor?: ExistsResponse;
    };

@Injectable({ providedIn: 'root' })
export class ServicioComisionableService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('servicio-comisionable');

  create(payload: ServicioComisionablePayload): Observable<ServicioComisionableResponse> {
    return this.http.post<ServicioComisionableResponse>(this.apiUrl, payload);
  }

  update(id: number, payload: ServicioComisionablePayload): Observable<ServicioComisionableResponse> {
    return this.http.put<ServicioComisionableResponse>(`${this.apiUrl}/${id}`, payload);
  }

  getById(id: number): Observable<ServicioComisionable> {
    return this.http.get<ServicioComisionableApi>(`${this.apiUrl}/${id}`).pipe(map((response) => this.normalizeServicio(response)));
  }

  list(empresaId: number): Observable<ServicioComisionable[]> {
    return this.http
      .get<ListResponse>(this.apiUrl, { params: toHttpParams({ empresaId }) })
      .pipe(map((response) => asArray(response).map((item) => this.normalizeServicio(item))));
  }

  activate(id: number, operador = ''): Observable<ServicioComisionableResponse> {
    return this.http.patch<ServicioComisionableResponse>(`${this.apiUrl}/${id}/activar`, {}, { params: toHttpParams({ operador }) });
  }

  deactivate(id: number, operador = ''): Observable<ServicioComisionableResponse> {
    return this.http.patch<ServicioComisionableResponse>(`${this.apiUrl}/${id}/desactivar`, {}, { params: toHttpParams({ operador }) });
  }

  exists(empresaId: number, codServicio: string): Observable<boolean> {
    return this.http
      .get<ExistsResponse>(`${this.apiUrl}/existe`, { params: toHttpParams({ empresaId, codServicio }) })
      .pipe(map((response) => this.normalizeExistsResponse(response)));
  }

  crear(payload: ServicioComisionablePayload): Observable<ServicioComisionableResponse> {
    return this.create(payload);
  }

  actualizar(id: number, payload: ServicioComisionablePayload): Observable<ServicioComisionableResponse> {
    return this.update(id, payload);
  }

  obtener(id: number): Observable<ServicioComisionable> {
    return this.getById(id);
  }

  listar(params?: QueryParams): Observable<ServicioComisionable[]> {
    return this.http
      .get<ListResponse>(this.apiUrl, { params: toHttpParams(params) })
      .pipe(map((response) => asArray(response).map((item) => this.normalizeServicio(item))));
  }

  activar(id: number, operador = ''): Observable<ServicioComisionableResponse> {
    return this.activate(id, operador);
  }

  desactivar(id: number, operador = ''): Observable<ServicioComisionableResponse> {
    return this.deactivate(id, operador);
  }

  existe(params?: QueryParams): Observable<boolean> {
    return this.http
      .get<ExistsResponse>(`${this.apiUrl}/existe`, { params: toHttpParams(params) })
      .pipe(map((response) => this.normalizeExistsResponse(response)));
  }

  private normalizeServicio(item: ServicioComisionableApi): ServicioComisionable {
    return {
      AD16_Id: this.readNumber(item, ['AD16_Id', 'aD16_Id']),
      AD16_EmpresaId: this.readNumber(item, ['AD16_EmpresaId', 'aD16_EmpresaId']),
      AD16_CodServicio: this.readText(item, ['AD16_CodServicio', 'aD16_CodServicio']),
      AD16_NombreServicio: this.readText(item, ['AD16_NombreServicio', 'MPV01_NomReceta', 'nombreServicio'], ''),
      AD16_Comisionable: this.readBoolean(item, ['AD16_Comisionable', 'aD16_Comisionable']),
      AD16_PermiteOverride: this.readBoolean(item, ['AD16_PermiteOverride', 'aD16_PermiteOverride']),
      AD16_Activo: this.readBoolean(item, ['AD16_Activo', 'aD16_Activo'], true),
      AD16_Observaciones: this.readText(item, ['AD16_Observaciones', 'aD16_Observaciones'], ''),
      AD16_Operador: this.readText(item, ['AD16_Operador', 'aD16_Operador'], ''),
      AD16_FechaRegistro: this.toDateOnly(this.readText(item, ['AD16_FechaRegistro', 'aD16_FechaRegistro'], ''))
    };
  }

  private normalizeExistsResponse(response: ExistsResponse): boolean {
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

  private readText(item: ServicioComisionableApi, keys: string[], fallback = ''): string {
    const value = this.readValue(item, keys, fallback);
    return String(value ?? fallback).trim();
  }

  private readNumber(item: ServicioComisionableApi, keys: string[], fallback = 0): number {
    const value = Number(this.readValue(item, keys, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  private readBoolean(item: ServicioComisionableApi, keys: string[], fallback = false): boolean {
    const value = this.readValue(item, keys, fallback);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return ['true', '1', 'si', 'sí', 's', 'activo'].includes(String(value ?? '').trim().toLowerCase());
  }

  private readValue(item: ServicioComisionableApi, keys: string[], fallback: unknown): unknown {
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
