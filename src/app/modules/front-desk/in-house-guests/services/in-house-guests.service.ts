import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { InHouseGuest, InHouseResponse } from '../models/in-house-guest.model';

@Injectable({ providedIn: 'root' })
export class InHouseGuestsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pax-in-house/lista-completa`;

  getInHouseGuests(fechaIni: string, fechaFin: string, operador: string): Observable<InHouseResponse> {
    const params = new HttpParams()
      .set('fechaIni', normalizePmsDateDDMMYYYY(fechaIni))
      .set('fechaFin', normalizePmsDateDDMMYYYY(fechaFin))
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
      return this.normalizeResponseDates(response.datos ?? this.emptyResponse());
    }

    return this.normalizeResponseDates(response as InHouseResponse);
  }

  private normalizeResponseDates(response: InHouseResponse): InHouseResponse {
    return {
      ...response,
      pax: (response.pax ?? []).map((guest: InHouseGuest) => ({
        ...guest,
        fechaIng: normalizePmsDateDDMMYYYY(guest.fechaIng),
        fechaSal: normalizePmsDateDDMMYYYY(guest.fechaSal)
      }))
    };
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
