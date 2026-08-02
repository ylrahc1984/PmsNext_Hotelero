import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { RoomChargeAnnulPayload, RoomChargePayload } from './room-charge-mutation.model';

@Injectable({ providedIn: 'root' })
export class RoomChargeMutationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/cargo-habitacion`;

  create(payload: RoomChargePayload): Observable<unknown> {
    return this.http
      .post(this.apiUrl, this.normalizePayload(payload), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  update(payload: RoomChargePayload): Observable<unknown> {
    return this.http
      .put(this.apiUrl, this.normalizePayload(payload), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  annul(payload: RoomChargeAnnulPayload): Observable<unknown> {
    return this.http
      .delete(this.apiUrl, { body: payload, responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private normalizePayload(payload: RoomChargePayload): RoomChargePayload {
    return {
      ...payload,
      fecha: normalizePmsDateDDMMYYYY(payload.fecha),
      detalle: payload.detalle.map((item) => ({
        ...item,
        fecha: normalizePmsDateDDMMYYYY(item.fecha)
      }))
    };
  }

  private parseTextResponse(response: string): unknown {
    const trimmed = (response || '').trim();
    if (!trimmed) return {};

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
