import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { FolioMaster } from '../models/folio-master.model';

interface FolioMasterApiResponse {
  datos?: FolioMaster[];
}

export interface FolioMasterCheckoutPayload {
  proceso        : number;
  fecCheckout    : string;
  codReserva     : string;
  numHabitacion  : string;
  folio          : string;
  operador       : string;
}

export interface FolioMasterCheckoutResponse {
  mensaje        ?: string;
  message        ?: string;
  codReserva     ?: string;
  numHabitacion  ?: string;
  fecCheckout    ?: string;
}

@Injectable({ providedIn: 'root' })
export class FolioMasterService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/foliomaster`;
  private readonly checkoutUrl = `${environment.apiUrl}/checkout/folio`;

  getPendingFolios(fechaIngreso: string, fechaSalida: string, filtro = ''): Observable<FolioMaster[]> {
    const params = new HttpParams()
      .set('fecIng', normalizePmsDateDDMMYYYY(fechaIngreso))
      .set('fecSal', normalizePmsDateDDMMYYYY(fechaSalida))
      .set('filtro', filtro.trim());

    return this.http.get<FolioMaster[] | FolioMasterApiResponse>(`${this.apiUrl}/pendientes`, { params }).pipe(
      map((response) => (Array.isArray(response) ? response : response?.datos ?? []))
    );
  }

  checkoutFolio(payload: FolioMasterCheckoutPayload): Observable<FolioMasterCheckoutResponse> {
    return this.http.post<FolioMasterCheckoutResponse>(this.checkoutUrl, {
      ...payload,
      fecCheckout: normalizePmsDateDDMMYYYY(payload.fecCheckout)
    });
  }
}
