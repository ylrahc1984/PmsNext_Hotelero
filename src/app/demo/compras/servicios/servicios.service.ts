import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';
import { Servicio } from './interfaces/Servicio.interface';
import { ServicioResponse } from './interfaces/ServicioResponse.interface';
import { ServicioRequest } from './interfaces/ServicioRequest.interface';

export interface ServiciosListResponse {
  datos?: Servicio[];
}

export interface ServicioCrudResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServiciosService {
  private readonly apiUrl = `${environment.apiUrl}/Servicios`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getServicios(filtro?: string): Observable<Servicio[]> {
    let params = new HttpParams();
    const normalized = this.normalizeValue(filtro);
    if (normalized) {
      params = params.set('filtro', normalized);
    }

    return this.http
      .get<ServiciosListResponse | Servicio[] | Servicio>(this.apiUrl, { params })
      .pipe(
        map((response) => {
          if (Array.isArray(response)) {
            return response;
          }
          if (response && 'datos' in response) {
            return Array.isArray(response.datos) ? response.datos : [];
          }
          return [];
        })
      );
  }

  getServicioPorId(codigo: string): Observable<Servicio | null> {
    const normalized = this.normalizeValue(codigo);
    if (!normalized) {
      return of(null);
    }
    const url = `${this.apiUrl}/${encodeURIComponent(normalized)}`;
    return this.http.get<ServicioResponse>(url).pipe(map((response) => response?.datos ?? null));
  }

  crearServicio(dto: ServicioRequest): Observable<ServicioCrudResponse> {
    const payload = this.decoratePayload(dto);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarServicio(dto: ServicioRequest): Observable<ServicioCrudResponse> {
    const payload = this.decoratePayload(dto);
    const codigo = payload.codigo.trim();
    return this.http
      .put(`${this.apiUrl}/${encodeURIComponent(codigo)}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarServicio(codigo: string): Observable<ServicioCrudResponse> {
    const normalized = this.normalizeValue(codigo) || '';
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(normalized)}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private decoratePayload(dto: ServicioRequest): ServicioRequest {
    return {
      ...dto,
      operador: dto.operador || this.auth.getCurrentUser()?.usuario || ''
    };
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseTextResponse(response: string): ServicioCrudResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as ServicioCrudResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
