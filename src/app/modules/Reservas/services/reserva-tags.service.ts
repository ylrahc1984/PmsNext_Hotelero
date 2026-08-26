import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  ApiResponse,
  GuardarReservaTagsBatchRequest,
  GuardarReservaTagsBatchResponse,
  ReservaTagAsignado,
  ReservaTagCatalogo
} from '../models/reserva-tag.model';

@Injectable({ providedIn: 'root' })
export class ReservaTagsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas`;

  buscarTags(busqueda: string, soloManuales = true): Observable<ApiResponse<ReservaTagCatalogo[]>> {
    let params = new HttpParams().set('soloManuales', String(soloManuales));
    const termino = busqueda.trim();
    if (termino) {
      params = params.set('busqueda', termino);
    }

    return this.http.get<ApiResponse<ReservaTagCatalogo[]>>(`${this.apiUrl}/tags`, { params });
  }

  obtenerTagsReserva(codReserva: string): Observable<ApiResponse<ReservaTagAsignado[]>> {
    return this.http.get<ApiResponse<ReservaTagAsignado[]>>(`${this.reservaUrl(codReserva)}/tags`);
  }

  guardarTagsBatch(
    codReserva: string,
    request: GuardarReservaTagsBatchRequest
  ): Observable<GuardarReservaTagsBatchResponse> {
    return this.http.post<GuardarReservaTagsBatchResponse>(`${this.reservaUrl(codReserva)}/tags/batch`, request);
  }

  retirarTag(codReserva: string, idTag: number, motivoRetiro: string): Observable<ApiResponse<null>> {
    const params = new HttpParams().set('motivoRetiro', motivoRetiro.trim());
    return this.http.delete<ApiResponse<null>>(`${this.reservaUrl(codReserva)}/tags/${encodeURIComponent(String(idTag))}`, { params });
  }

  private reservaUrl(codReserva: string): string {
    return `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
  }
}
