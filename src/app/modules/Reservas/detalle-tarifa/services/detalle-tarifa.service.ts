import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DetalleTarifaRequest, DetalleTarifaResponse } from '../models/detalle-tarifa.model';

type DetalleTarifaApiResponse = DetalleTarifaResponse[] | DetalleTarifaResponse | null;

@Injectable({ providedIn: 'root' })
export class DetalleTarifaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').replace(/\/+$/, '')}/detalle-tarifa-habitacion`;

  getByCategoria(codigoTarifa: string, categoriaHabitacion: string): Observable<DetalleTarifaResponse[]> {
    const params = new HttpParams()
      .set('codigoTarifa', codigoTarifa)
      .set('categoriaHabitacion', categoriaHabitacion);

    return this.http
      .get<DetalleTarifaApiResponse>(`${this.apiUrl}/categoria`, { params })
      .pipe(map((response) => this.normalizeList(response)));
  }

  create(request: DetalleTarifaRequest): Observable<DetalleTarifaRequest> {
    return this.http.post<DetalleTarifaRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  update(codigoTarifa: string, request: DetalleTarifaRequest): Observable<DetalleTarifaRequest> {
    return this.http.put<DetalleTarifaRequest>(`${this.apiUrl}/${encodeURIComponent(codigoTarifa)}`, { ...request, proceso: 2 });
  }

  delete(codigoTarifa: string, categoria: string, tipo: string, operador: string): Observable<DetalleTarifaRequest> {
    const params = new HttpParams().set('operador', operador);
    return this.http.delete<DetalleTarifaRequest>(
      `${this.apiUrl}/${encodeURIComponent(codigoTarifa)}/${encodeURIComponent(categoria)}/${encodeURIComponent(tipo)}`,
      { params }
    );
  }

  private normalizeList(response: DetalleTarifaApiResponse): DetalleTarifaResponse[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [response];
  }
}
