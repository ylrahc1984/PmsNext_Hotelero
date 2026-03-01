import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';
import { LineaProducto } from './interfaces/LineaProducto.interface';
import { LineaProductoRequest } from './interfaces/LineaProductoRequest.interface';

export interface LineaProductoResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LineaProductoService {
  private readonly apiUrl = `${environment.apiUrl}/lineaproducto`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getLineas(filtro?: string): Observable<LineaProducto[]> {
    let params = new HttpParams();
    const normalized = this.normalizeValue(filtro);
    if (normalized) {
      params = params.set('LineaProdu', normalized);
    }

    return this.http
      .get<LineaProducto[] | LineaProducto>(this.apiUrl, { params })
      .pipe(map((response) => this.ensureArray(response)));
  }

  crearLinea(dto: LineaProductoRequest): Observable<LineaProductoResponse> {
    const payload = this.decoratePayload(dto);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarLinea(dto: LineaProductoRequest): Observable<LineaProductoResponse> {
    const payload = this.decoratePayload(dto);
    const codLinea = payload.codLinea.trim();
    return this.http
      .put(`${this.apiUrl}/${encodeURIComponent(codLinea)}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarLinea(codLinea: string): Observable<LineaProductoResponse> {
    const normalized = this.normalizeValue(codLinea) || '';
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(normalized)}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private decoratePayload(dto: LineaProductoRequest): LineaProductoRequest {
    return {
      ...dto,
      operador: dto.operador || this.auth.getCurrentUser()?.usuario || '',
      respuesta: dto.respuesta ?? ''
    };
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private ensureArray<T>(value: T[] | T | null | undefined): T[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  private parseTextResponse(response: string): LineaProductoResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as LineaProductoResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
