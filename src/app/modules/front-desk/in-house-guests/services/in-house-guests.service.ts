import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import { InHouseResponse } from '../models/in-house-guest.model';

@Injectable({ providedIn: 'root' })
export class InHouseGuestsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pax-in-house/lista-completa`;

  getInHouseGuests(fechaIni: string, fechaFin: string, operador: string): Observable<InHouseResponse> {
    const params = new HttpParams()
      .set('fechaIni', fechaIni)
      .set('fechaFin', fechaFin)
      .set('operador', operador);

    return this.http
      .get<InHouseResponse | { datos?: InHouseResponse }>(this.apiUrl, { params })
      .pipe(
        map((response) => this.mapResponse(response)),
        catchError((error) => throwError(() => error))
      );
  }

  private mapResponse(response: InHouseResponse | { datos?: InHouseResponse } | null | undefined): InHouseResponse {
    if (!response) {
      return this.emptyResponse();
    }

    if ('datos' in response) {
      return response.datos ?? this.emptyResponse();
    }

    return response as InHouseResponse;
  }

  private emptyResponse(): InHouseResponse {
    return {
      pax: [],
      totalHabitaciones: 0,
      totalAdultos: 0,
      totalNinos: 0,
      totalHuespedes: 0,
      respuesta: ''
    };
  }
}
