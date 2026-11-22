import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface GuestDigitalFilePrecheckin {
  idPreCheckIn: number | string;
  codReserva: string;
  idDesglose: number | string;
  estadoPreCheckIn?: string | null;
  fechaCompletado?: string | null;
  alergias?: string | null;
  observaciones?: string | null;
  placa?: string | null;
  idRegistro?: number | string | null;
  nombreFirmante?: string | null;
  fechaFirma?: string | null;
  versionTerminos?: string | null;
  aceptaTerminos?: boolean | null;
  tienePdfFirmado?: boolean | null;
}

export interface GuestDigitalFileApiResponse<T> {
  success: boolean;
  message?: string | null;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class GuestDigitalFileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/frontdesk/expediente-digital`;

  getPrecheckins(codReserva: string, idDesglose: string): Observable<GuestDigitalFileApiResponse<GuestDigitalFilePrecheckin[]>> {
    const params = new HttpParams().set('idDesglose', idDesglose);
    return this.http.get<GuestDigitalFileApiResponse<GuestDigitalFilePrecheckin[]>>(
      `${this.apiUrl}/reservas/${encodeURIComponent(codReserva)}/precheckin`, { params }
    );
  }

  getReservationRecords(codReserva: string): Observable<GuestDigitalFileApiResponse<unknown[]>> {
    return this.http.get<GuestDigitalFileApiResponse<unknown[]>>(`${this.apiUrl}/reservas/${encodeURIComponent(codReserva)}/registros`);
  }

  getRecord(idPreCheckIn: number | string): Observable<GuestDigitalFileApiResponse<unknown>> {
    return this.http.get<GuestDigitalFileApiResponse<unknown>>(`${this.apiUrl}/registros/${encodeURIComponent(String(idPreCheckIn))}`);
  }

  getSignedPdf(idPreCheckIn: number | string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/registros/${encodeURIComponent(String(idPreCheckIn))}/pdf`, { responseType: 'blob' });
  }
}
