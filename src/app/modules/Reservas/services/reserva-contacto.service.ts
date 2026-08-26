import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  GuardarReservaContactoRequest,
  ReservaContacto,
  ReservaContactoApiResponse
} from '../models/reserva-contacto.model';

@Injectable({ providedIn: 'root' })
export class ReservaContactoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas`;

  obtenerContactoReserva(codReserva: string): Observable<ReservaContactoApiResponse<ReservaContacto>> {
    return this.http.get<ReservaContactoApiResponse<ReservaContacto>>(`${this.reservaUrl(codReserva)}/contacto`);
  }

  guardarContactoReserva(
    codReserva: string,
    request: GuardarReservaContactoRequest
  ): Observable<ReservaContactoApiResponse<ReservaContacto>> {
    return this.http.put<ReservaContactoApiResponse<ReservaContacto>>(`${this.reservaUrl(codReserva)}/contacto`, request);
  }

  private reservaUrl(codReserva: string): string {
    return `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
  }
}
