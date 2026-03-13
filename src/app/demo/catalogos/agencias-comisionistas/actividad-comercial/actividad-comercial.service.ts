import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ActividadDto, ActividadPost, ActividadResponse } from './actividad-comercial.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ActividadComercialService {
  private apiUrl = `${environment.apiUrl}/actividadcomercialmh`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getActividades(cedula: string): Observable<ActividadDto[]> {
    return this.http.get<ActividadDto[]>(`${this.apiUrl}?cedula=${encodeURIComponent(cedula)}`);
  }

  crearActividad(payload: ActividadPost): Observable<ActividadResponse> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload, 1), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarActividad(payload: ActividadPost): Observable<ActividadResponse> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload, 2), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarActividad(id: number, cedula: string, codigoAmh: string): Observable<ActividadResponse> {
    const encodedCedula = encodeURIComponent(cedula);
    const encodedCodigo = encodeURIComponent(codigoAmh);
    return this.http
      .delete(`${this.apiUrl}/${id}?cedula=${encodedCedula}&codigoAmh=${encodedCodigo}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  buildPayload(partial: Partial<ActividadPost>, proceso: number): ActividadPost {
    return this.decoratePayload(
      {
        proceso,
        id: partial.id ?? 0,
        cedula: partial.cedula ?? '',
        codigoAMH: partial.codigoAMH ?? '',
        descripcion: partial.descripcion ?? '',
        principal: partial.principal ?? 0,
        operador: partial.operador ?? '',
        respuesta: partial.respuesta ?? ''
      },
      proceso
    );
  }

  private decoratePayload(payload: ActividadPost, proceso: number): ActividadPost {
    return {
      ...payload,
      proceso,
      operador: payload.operador || this.auth.getCurrentUser()?.usuario || '',
      respuesta: payload.respuesta ?? ''
    };
  }

  private parseTextResponse(response: string): ActividadResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as ActividadResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
