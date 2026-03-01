import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { CompraArticuloRequest } from './nueva-compra-articulos/interfaces/CompraArticuloRequest.interface';

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
