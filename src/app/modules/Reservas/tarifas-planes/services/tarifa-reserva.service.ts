import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { TarifaReservaRequest, TarifaReservaResponse } from '../models/tarifa-reserva.model';

interface TarifaReservaEnvelope {
  datos?: TarifaReservaResponse[] | TarifaReservaResponse | null;
}

type TarifaReservaApiResponse = TarifaReservaResponse[] | TarifaReservaResponse | TarifaReservaEnvelope | null;

@Injectable({ providedIn: 'root' })
export class TarifaReservaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').replace(/\/+$/, '')}/tarifa-reserva`;

  getAll(): Observable<TarifaReservaResponse[]> {
    return this.http.get<TarifaReservaApiResponse>(this.apiUrl).pipe(map((response) => this.normalizeList(response)));
  }

  getByCodigo(codigo: string): Observable<TarifaReservaResponse | TarifaReservaResponse[]> {
    const params = new HttpParams().set('codigo', codigo);
    return this.http
      .get<TarifaReservaApiResponse>(this.apiUrl, { params })
      .pipe(map((response) => this.normalizeSingleOrList(response)));
  }

  create(request: TarifaReservaRequest): Observable<TarifaReservaRequest> {
    return this.http
      .post<TarifaReservaRequest>(this.apiUrl, this.normalizeRequest(request, 1))
      .pipe(map((response) => this.normalizeRequest(response, response.proceso)));
  }

  update(codigo: string, request: TarifaReservaRequest): Observable<TarifaReservaRequest> {
    return this.http
      .put<TarifaReservaRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, this.normalizeRequest(request, 2))
      .pipe(map((response) => this.normalizeRequest(response, response.proceso)));
  }

  delete(codigo: string): Observable<TarifaReservaRequest> {
    return this.http
      .delete<TarifaReservaRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`)
      .pipe(map((response) => this.normalizeRequest(response, response.proceso)));
  }

  private normalizeSingleOrList(response: TarifaReservaApiResponse): TarifaReservaResponse | TarifaReservaResponse[] {
    const tarifas = this.normalizeList(response);
    return tarifas.length === 1 ? tarifas[0] : tarifas;
  }

  private normalizeList(response: TarifaReservaApiResponse): TarifaReservaResponse[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response.map((item) => this.normalizeItem(item));
    }

    if (this.hasDatos(response)) {
      const datos = response.datos;
      if (!datos) {
        return [];
      }

      return Array.isArray(datos) ? datos.map((item) => this.normalizeItem(item)) : [this.normalizeItem(datos)];
    }

    return [this.normalizeItem(response)];
  }

  private normalizeRequest(request: TarifaReservaRequest, proceso: number): TarifaReservaRequest {
    return {
      ...request,
      proceso,
      fechaInicial: normalizePmsDateDDMMYYYY(request.fechaInicial),
      fechaFin: normalizePmsDateDDMMYYYY(request.fechaFin)
    };
  }

  private normalizeItem(item: TarifaReservaResponse): TarifaReservaResponse {
    return {
      ...item,
      MR03_FecInicial: normalizePmsDateDDMMYYYY(item.MR03_FecInicial),
      MR03_FecFin: normalizePmsDateDDMMYYYY(item.MR03_FecFin)
    };
  }

  private hasDatos(response: TarifaReservaResponse | TarifaReservaEnvelope): response is TarifaReservaEnvelope {
    return Object.prototype.hasOwnProperty.call(response, 'datos');
  }
}
