import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { extractCodReserva } from '../reserva-create.utils';
import { ReservaToursCompletaResponseDto, ReservaToursPayloadDto, ReservaToursSaveResponseDto } from './reserva-tours.models';

@Injectable({ providedIn: 'root' })
export class ReservaToursV2Service {
  private apiUrl = `${environment.apiUrl}/reserva-tours`;

  constructor(private http: HttpClient) {}

  crearReserva(payload: ReservaToursPayloadDto): Observable<ReservaToursSaveResponseDto> {
    return this.http.post(this.apiUrl, payload, { responseType: 'text' }).pipe(map((response) => this.normalizeSaveResponse(response)));
  }

  getReservaCompleta(codReserva: string): Observable<ReservaToursCompletaResponseDto> {
    const encoded = encodeURIComponent((codReserva ?? '').toString().trim());
    return this.http.get<ReservaToursCompletaResponseDto>(`${this.apiUrl}/${encoded}/completa`);
  }

  actualizarReserva(codReserva: string, payload: ReservaToursPayloadDto): Observable<ReservaToursSaveResponseDto> {
    const encoded = encodeURIComponent((codReserva ?? '').toString().trim());
    return this.http
      .put(`${this.apiUrl}/${encoded}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.normalizeSaveResponse(response)));
  }

  private normalizeSaveResponse(response: string): ReservaToursSaveResponseDto {
    const raw = (response ?? '').toString().trim();
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      const codReserva = extractCodReserva(parsed);
      return codReserva ? { ...parsed, codReserva, CodReserva: codReserva } : parsed;
    } catch {
      return { codReserva: raw, CodReserva: raw };
    }
  }
}
