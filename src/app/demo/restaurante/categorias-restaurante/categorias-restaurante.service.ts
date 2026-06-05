import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

interface CategoriaApiDto {
  MPV00_CodCategoria: string;
  MPV00_NomCategoria: string;
  MPV00_VisiblePnt: number;
  MPV00_Orden: number;
  MPV00_Operador: string;
}

export interface CategoriaRestaurante {
  codCateg: string;
  nomCateg: string;
  visiblePnt: number;
  orden: number;
  operador: string;
}

export interface CategoriaRestaurantePayload {
  proceso: number;
  codCateg: string;
  nomCateg: string;
  visiblePnt: number;
  orden: number;
  operador: string;
  respuesta: string;
}

export interface CategoriaRestauranteResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriasRestauranteService {
  private readonly apiUrl = `${environment.apiUrl}/categoria`;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  getCategorias(): Observable<CategoriaRestaurante[]> {
    return this.http.get<CategoriaApiDto[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  getCategoriaByCodigo(codCateg: string): Observable<CategoriaRestaurante | null> {
    const normalized = this.normalizeValue(codCateg);
    if (!normalized) {
      return new Observable((subscriber) => {
        subscriber.next(null);
        subscriber.complete();
      });
    }

    const params = new HttpParams().set('codCateg', normalized);
    return this.http.get<CategoriaApiDto[]>(this.apiUrl, { params }).pipe(
      map((response) => {
        const item = response?.[0];
        return item ? this.mapFromApi(item) : null;
      })
    );
  }

  crearCategoria(payload: CategoriaRestaurantePayload): Observable<CategoriaRestauranteResponse> {
    const dto = this.decoratePayload(payload);
    return this.http.post(this.apiUrl, dto, { responseType: 'text' }).pipe(
      map((response) => this.parseTextResponse(response))
    );
  }

  actualizarCategoria(codCateg: string, payload: CategoriaRestaurantePayload): Observable<CategoriaRestauranteResponse> {
    const normalized = this.normalizeValue(codCateg) || payload.codCateg;
    const dto = this.decoratePayload(payload);
    return this.http.put(`${this.apiUrl}/${encodeURIComponent(normalized)}`, dto, { responseType: 'text' }).pipe(
      map((response) => this.parseTextResponse(response))
    );
  }

  eliminarCategoria(codCateg: string): Observable<CategoriaRestauranteResponse> {
    const normalized = this.normalizeValue(codCateg) || '';
    return this.http.delete(`${this.apiUrl}/${encodeURIComponent(normalized)}`, { responseType: 'text' }).pipe(
      map((response) => this.parseTextResponse(response))
    );
  }

  private mapFromApi(api: CategoriaApiDto): CategoriaRestaurante {
    return {
      codCateg: (api.MPV00_CodCategoria || '').trim(),
      nomCateg: (api.MPV00_NomCategoria || '').trim(),
      visiblePnt: Number(api.MPV00_VisiblePnt ?? 0),
      orden: Number(api.MPV00_Orden ?? 0),
      operador: (api.MPV00_Operador || '').trim()
    };
  }

  private decoratePayload(payload: CategoriaRestaurantePayload): CategoriaRestaurantePayload {
    return {
      ...payload,
      codCateg: (payload.codCateg || '').trim(),
      nomCateg: (payload.nomCateg || '').trim(),
      visiblePnt: Number(payload.visiblePnt ?? 0),
      orden: Number(payload.orden ?? 0),
      operador: (payload.operador || this.auth.getCurrentUser()?.usuario || '').trim(),
      respuesta: payload.respuesta ?? ''
    };
  }

  private normalizeValue(value?: string): string | undefined {
    const trimmed = (value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseTextResponse(response: string): CategoriaRestauranteResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as CategoriaRestauranteResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
