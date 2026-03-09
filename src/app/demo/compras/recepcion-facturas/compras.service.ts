import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { CompraArticuloRequest } from './nueva-compra-articulos/interfaces/CompraArticuloRequest.interface';
import { CompraArticuloDetalleData, CompraArticuloDetalleResponse } from './interfaces/compra-articulo-detalle.interface';

export interface CompraArticuloResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  private readonly apiUrl = `${environment.apiUrl}/compras`;

  constructor(private http: HttpClient) {}

  crearCompraArticulo(payload: CompraArticuloRequest): Observable<CompraArticuloResponse> {
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  getCompraArticuloDetalle(tipDocu: string, numDocu: string): Observable<CompraArticuloDetalleData | null> {
    return this.http
      .get<CompraArticuloDetalleResponse>(`${this.apiUrl}/${tipDocu}/${numDocu}`)
      .pipe(map((response) => response?.data ?? null));
  }

  actualizarCompraArticulo(
    tipDocu: string,
    numDocu: string,
    payload: CompraArticuloRequest
  ): Observable<CompraArticuloResponse> {
    return this.http
      .put(`${this.apiUrl}/${tipDocu}/${numDocu}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarCompraArticulo(tipDocu: string, numDocu: string, operador: string): Observable<void> {
    const params = new HttpParams().set('operador', operador);
    return this.http.delete<void>(`${this.apiUrl}/${tipDocu}/${numDocu}`, { params });
  }

  private parseTextResponse(response: string): CompraArticuloResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as CompraArticuloResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
