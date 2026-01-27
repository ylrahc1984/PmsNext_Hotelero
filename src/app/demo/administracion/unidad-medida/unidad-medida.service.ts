import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { UnidadMedidaDto, UnidadMedidaPost, UnidadMedidaResponse } from './unidad-medida.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class UnidadMedidaService {
  private apiUrl = `${environment.apiUrl}/unidadmedida`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getUnidades(): Observable<UnidadMedidaDto[]> {
    return this.http.get<UnidadMedidaDto[]>(this.apiUrl).pipe(map((response) => response ?? []));
  }

  getUnidadByCodigo(codUMed: string): Observable<UnidadMedidaDto | null> {
    const normalized = codUMed.trim().toLowerCase();
    return this.getUnidades().pipe(
      map((items) => items.find((item) => item.CAC04_UnmMed.toLowerCase() === normalized) ?? null)
    );
  }

  crearUnidad(payload: UnidadMedidaPost): Observable<UnidadMedidaResponse> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload, 1), { responseType: 'text' })
      .pipe(map((respuesta) => ({ respuesta: respuesta || 'OK' } as UnidadMedidaResponse)));
  }

  editarUnidad(codUMed: string, payload: UnidadMedidaPost): Observable<UnidadMedidaResponse> {
    return this.http
      .put(`${this.apiUrl}/${codUMed}`, this.decoratePayload(payload, 2), { responseType: 'text' })
      .pipe(map((respuesta) => ({ respuesta: respuesta || 'OK' } as UnidadMedidaResponse)));
  }

  eliminarUnidad(codUMed: string): Observable<UnidadMedidaResponse> {
    return this.http
      .delete(`${this.apiUrl}/${codUMed}`, { responseType: 'text' })
      .pipe(map((respuesta) => ({ respuesta: respuesta || 'OK' } as UnidadMedidaResponse)));
  }

  buildPayload(codUMed: string, descripcion: string, proceso: number): UnidadMedidaPost {
    return {
      proceso,
      codUMed,
      descripcion,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private decoratePayload(payload: UnidadMedidaPost, proceso: number): UnidadMedidaPost {
    return {
      ...payload,
      proceso,
      operador: payload.operador || this.auth.getCurrentUser()?.usuario || '',
      respuesta: payload.respuesta ?? ''
    };
  }
}
