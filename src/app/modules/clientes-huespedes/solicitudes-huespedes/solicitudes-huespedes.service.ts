import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  SolicitudHuesped,
  SolicitudHuespedCrearApiResponse,
  SolicitudHuespedCrearRequest,
  SolicitudHuespedOperacionRequest,
  SolicitudesHuespedApiResponse,
  SolicitudesHuespedFiltros,
  SolicitudHuespedTipo,
  SolicitudesHuespedTiposApiResponse
} from './solicitudes-huespedes.models';

@Injectable({ providedIn: 'root' })
export class SolicitudHuespedService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/solicitudes-huesped`;

  consultar(filtros: SolicitudesHuespedFiltros = {}): Observable<SolicitudHuesped[]> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.area) params = params.set('area', filtros.area);
    return this.http.get<SolicitudesHuespedApiResponse>(this.apiUrl, { params }).pipe(
      map((response) => Array.isArray(response.data) ? response.data : [])
    );
  }

  consultarPorId(idSolicitud: number): Observable<SolicitudHuesped> {
    return this.http.get<SolicitudesHuespedApiResponse>(`${this.apiUrl}/${encodeURIComponent(String(idSolicitud))}`).pipe(
      map((response) => response.data[0])
    );
  }

  consultarTipos(): Observable<SolicitudHuespedTipo[]> {
    return this.http.get<SolicitudesHuespedTiposApiResponse>(`${this.apiUrl}/tipos`).pipe(
      map((response) => Array.isArray(response.data) ? response.data : [])
    );
  }

  crear(request: SolicitudHuespedCrearRequest): Observable<SolicitudHuesped> {
    return this.http.post<SolicitudHuespedCrearApiResponse>(this.apiUrl, request).pipe(
      map((response) => response.data)
    );
  }

  atender(idSolicitud: number, request: SolicitudHuespedOperacionRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(String(idSolicitud))}/atender`, request);
  }

  completar(idSolicitud: number, request: SolicitudHuespedOperacionRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(String(idSolicitud))}/completar`, request);
  }

  cancelar(idSolicitud: number, request: SolicitudHuespedOperacionRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(String(idSolicitud))}/cancelar`, request);
  }
}
