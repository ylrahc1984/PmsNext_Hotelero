import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { mapReservaCompletaToHospedajeDetalle } from './reserva-hospedaje-detalle.mapper';
import { ReservaCompletaDto, ReservaHospedajeDetalle } from './reserva-hospedaje-detalle.model';

@Injectable({ providedIn: 'root' })
export class ReservaHospedajeDetalleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/reserva-completa`;

  getByReservationCode(codReserva: string): Observable<ReservaHospedajeDetalle> {
    const url = `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
    return this.http.get<ReservaCompletaDto>(url).pipe(map(mapReservaCompletaToHospedajeDetalle));
  }
}
