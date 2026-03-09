import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { CompraServicioDetalleData, CompraServicioDetalleResponse } from '../interfaces/compra-servicio-detalle.interface';

export interface CompraServicioResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComprasServiciosService {
  private readonly apiUrl = `${environment.apiUrl}/compras-servicios`;

  constructor(private http: HttpClient) {}

  crearCompraServicio(payload: unknown): Observable<CompraServicioResponse> {
    console.groupCollapsed(`[ComprasServicios] POST ${this.apiUrl}`);
    console.log('payload', payload);
    console.log('payload.json', JSON.stringify(payload, null, 2));
    console.groupEnd();
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  getCompraServicioDetalle(tipDocu: string, numDocu: string): Observable<CompraServicioDetalleData | null> {
    const url = `${this.apiUrl}/${encodeURIComponent(tipDocu)}/${encodeURIComponent(numDocu)}`;
    return this.http.get<CompraServicioDetalleResponse>(url).pipe(map((response) => response?.data ?? null));
  }

  actualizarCompraServicio(tipDocu: string, numDocu: string, payload: unknown): Observable<CompraServicioResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(tipDocu)}/${encodeURIComponent(numDocu)}`;
    console.groupCollapsed(`[ComprasServicios] PUT ${url}`);
    console.log('payload', payload);
    console.log('payload.json', JSON.stringify(payload, null, 2));
    console.groupEnd();
    return this.http.put(url, payload, { responseType: 'text' }).pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarCompraServicio(tipDocu: string, numDocu: string, operador: string): Observable<CompraServicioResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(tipDocu)}/${encodeURIComponent(numDocu)}`;
    console.groupCollapsed(`[ComprasServicios] DELETE ${url}`);
    console.log('operador', operador);
    console.groupEnd();
    return this.http
      .delete(url, {
        params: { operador },
        responseType: 'text'
      })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private parseTextResponse(response: string): CompraServicioResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as CompraServicioResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
