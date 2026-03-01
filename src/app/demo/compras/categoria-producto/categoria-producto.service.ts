import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';
import { CategoriaProducto } from './interfaces/CategoriaProducto.interface';
import { CategoriaProductoRequest } from './interfaces/CategoriaProductoRequest.interface';

export interface CategoriaProductoResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaProductoService {
  private readonly apiUrl = `${environment.apiUrl}/categoriaproducto`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getCategoriasPorLinea(linea: string): Observable<CategoriaProducto[]> {
    const normalized = this.normalizeValue(linea);
    if (!normalized) {
      return of([]);
    }
    const url = `${this.apiUrl}/linea/${encodeURIComponent(normalized)}`;
    return this.http
      .get<CategoriaProducto[] | CategoriaProducto>(url)
      .pipe(map((response) => this.ensureArray(response)));
  }

  crearCategoria(dto: CategoriaProductoRequest): Observable<CategoriaProductoResponse> {
    const payload = this.decoratePayload(dto);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarCategoria(dto: CategoriaProductoRequest): Observable<CategoriaProductoResponse> {
    const payload = this.decoratePayload(dto);
    const codCate = payload.codCate.trim();
    return this.http
      .put(`${this.apiUrl}/${encodeURIComponent(codCate)}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarCategoria(codCate: string): Observable<CategoriaProductoResponse> {
    const normalized = this.normalizeValue(codCate) || '';
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(normalized)}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private decoratePayload(dto: CategoriaProductoRequest): CategoriaProductoRequest {
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

  private parseTextResponse(response: string): CategoriaProductoResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as CategoriaProductoResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
