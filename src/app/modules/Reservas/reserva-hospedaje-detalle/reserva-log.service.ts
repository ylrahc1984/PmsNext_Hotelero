import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ReservaLogResponse } from './reserva-log.model';

@Injectable({ providedIn: 'root' })
export class ReservaLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/log-reservas/reserva`;

  getByReservationCode(codReserva: string): Observable<ReservaLogResponse> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    return this.http.get<ReservaLogResponse>(url);
  }
}
