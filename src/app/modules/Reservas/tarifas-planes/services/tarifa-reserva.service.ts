import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

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
    return this.http.post<TarifaReservaRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  update(codigo: string, request: TarifaReservaRequest): Observable<TarifaReservaRequest> {
    return this.http.put<TarifaReservaRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  delete(codigo: string): Observable<TarifaReservaRequest> {
    return this.http.delete<TarifaReservaRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
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
      return response;
    }

    if (this.hasDatos(response)) {
      const datos = response.datos;
      if (!datos) {
        return [];
      }

      return Array.isArray(datos) ? datos : [datos];
    }

    return [response];
  }

  private hasDatos(response: TarifaReservaResponse | TarifaReservaEnvelope): response is TarifaReservaEnvelope {
    return Object.prototype.hasOwnProperty.call(response, 'datos');
  }
}
