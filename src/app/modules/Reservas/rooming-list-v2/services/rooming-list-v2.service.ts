import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  RoomingListV2ApiResponse,
  RoomingListV2GuardarRequest,
  RoomingListV2Huesped,
  RoomingListV2IdentificacionRequest,
  RoomingListV2Resultado
} from '../models/rooming-list-v2.model';

@Injectable({ providedIn: 'root' })
export class RoomingListV2Service {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/rooming-list/v2`;

  consultar(
    codReserva: string,
    idDesglose: string
  ): Observable<RoomingListV2ApiResponse<RoomingListV2Huesped[]>> {
    const url = `${this.apiUrl}/reservas/${encodeURIComponent(codReserva.trim())}/desgloses/${encodeURIComponent(idDesglose.trim())}`;
    return this.http.get<RoomingListV2ApiResponse<RoomingListV2Huesped[]>>(url);
  }

  registrar(request: RoomingListV2GuardarRequest): Observable<RoomingListV2ApiResponse<RoomingListV2Resultado>> {
    return this.http.post<RoomingListV2ApiResponse<RoomingListV2Resultado>>(`${this.apiUrl}/huespedes`, request);
  }

  actualizar(
    idRooming: string,
    request: RoomingListV2GuardarRequest
  ): Observable<RoomingListV2ApiResponse<unknown>> {
    const url = `${this.apiUrl}/huespedes/${encodeURIComponent(idRooming.trim())}`;
    return this.http.put<RoomingListV2ApiResponse<unknown>>(url, request);
  }

  desactivar(
    idRooming: string,
    request: RoomingListV2IdentificacionRequest
  ): Observable<RoomingListV2ApiResponse<unknown>> {
    const url = `${this.apiUrl}/huespedes/${encodeURIComponent(idRooming.trim())}`;
    return this.http.request<RoomingListV2ApiResponse<unknown>>('DELETE', url, { body: request });
  }

  asignarResponsable(
    idRooming: string,
    request: RoomingListV2IdentificacionRequest
  ): Observable<RoomingListV2ApiResponse<unknown>> {
    const url = `${this.apiUrl}/huespedes/${encodeURIComponent(idRooming.trim())}/responsable`;
    return this.http.put<RoomingListV2ApiResponse<unknown>>(url, request);
  }
}
