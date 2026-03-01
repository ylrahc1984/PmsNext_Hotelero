import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

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
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
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
