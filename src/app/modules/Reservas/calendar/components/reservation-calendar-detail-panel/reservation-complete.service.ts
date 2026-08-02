import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ReservationCompleteResponse } from './reservation-complete.model';

@Injectable({ providedIn: 'root' })
export class ReservationCompleteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/reserva-completa`;

  getByReservationCode(reservationCode: string): Observable<ReservationCompleteResponse> {
    return this.http.get<ReservationCompleteResponse>(`${this.apiUrl}/${encodeURIComponent(reservationCode.trim())}`);
  }
}
