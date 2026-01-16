import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { TipoClienteDto, TipoClientePost, TipoClienteResponse } from './tipo-cliente.models';

@Injectable({ providedIn: 'root' })
export class TipoClienteService {
  private apiUrl = 'http://localhost:5000/api/tipocliente';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getTipoClientes(): Observable<TipoClienteDto[]> {
    return this.http.get<TipoClienteDto[] | TipoClienteDto>(this.apiUrl).pipe(
      map((response) => {
        if (!response) {
          return [];
        }
        return Array.isArray(response) ? response : [response];
      })
    );
  }

  getTipoClienteByCodigo(codTipo: string): Observable<TipoClienteDto | null> {
    const encoded = encodeURIComponent(codTipo);
    return this.http.get<TipoClienteDto | TipoClienteDto[]>(`${this.apiUrl}?codTipo=${encoded}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        return item ?? null;
      })
    );
  }

  crearTipoCliente(payload: TipoClientePost): Observable<TipoClienteResponse> {
    return this.http.post<TipoClienteResponse>(this.apiUrl, this.decoratePayload(payload, 1));
  }

  editarTipoCliente(codTipo: string, payload: TipoClientePost): Observable<TipoClienteResponse> {
    const encoded = encodeURIComponent(codTipo);
    return this.http.put<TipoClienteResponse>(`${this.apiUrl}?codTipo=${encoded}`, this.decoratePayload(payload, 2));
  }

  eliminarTipoCliente(codTipo: string): Observable<TipoClienteResponse> {
    const encoded = encodeURIComponent(codTipo);
    return this.http.delete<TipoClienteResponse>(`${this.apiUrl}?codTipo=${encoded}`);
  }

  buildPayload(codTipo: string, tipoCliente: string, proceso: number): TipoClientePost {
    return {
      proceso,
      codTipo,
      tipoCliente,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private decoratePayload(payload: TipoClientePost, proceso: number): TipoClientePost {
    return {
      ...payload,
      proceso,
      operador: payload.operador || this.auth.getCurrentUser()?.usuario || '',
      respuesta: payload.respuesta ?? ''
    };
  }
}
