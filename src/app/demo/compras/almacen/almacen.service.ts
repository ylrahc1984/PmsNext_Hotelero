import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';
import { Almacen } from './interfaces/Almacen.interface';
import { AlmacenRequest } from './interfaces/AlmacenRequest.interface';

export interface AlmacenResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlmacenService {
  private readonly apiUrl = `${environment.apiUrl}/almacen`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAlmacenes(filtro?: string): Observable<Almacen[]> {
    let params = new HttpParams();
    const normalized = this.normalizeValue(filtro);
    if (normalized) {
      params = params.set('NomAlma', normalized);
    }
    return this.http
      .get<Almacen[] | Almacen>(this.apiUrl, { params })
      .pipe(map((response) => this.ensureArray(response)));
  }

  getAlmacenPorId(codAlma: string): Observable<Almacen | null> {
    const normalized = this.normalizeValue(codAlma);
    if (!normalized) {
      return of(null);
    }
    let params = new HttpParams().set('CodAlma', normalized);
    return this.http.get<Almacen[] | Almacen>(this.apiUrl, { params }).pipe(
      map((response) => {
        const items = this.ensureArray(response);
        return items[0] ?? null;
      })
    );
  }

  crearAlmacen(dto: AlmacenRequest): Observable<AlmacenResponse> {
    const payload = this.decoratePayload(dto);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  actualizarAlmacen(dto: AlmacenRequest): Observable<AlmacenResponse> {
    const payload = this.decoratePayload(dto);
    const codAlma = payload.codAlma.trim();
    return this.http
      .put(`${this.apiUrl}/${encodeURIComponent(codAlma)}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  eliminarAlmacen(codAlma: string): Observable<AlmacenResponse> {
    const normalized = this.normalizeValue(codAlma) || '';
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(normalized)}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private decoratePayload(dto: AlmacenRequest): AlmacenRequest {
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

  private parseTextResponse(response: string): AlmacenResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as AlmacenResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
