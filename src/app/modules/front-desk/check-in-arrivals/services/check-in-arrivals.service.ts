import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { CheckInArrival, CheckInRequest, RoomingListGuest, RoomingListMutationResponse, RoomingListSaveRequest } from '../models/check-in-arrival.model';

@Injectable({ providedIn: 'root' })
export class CheckInArrivalsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/checkin/pendientes`;
  private readonly checkInUrl = `${environment.apiUrl}/checkin`;
  private readonly roomingListUrl = `${environment.apiUrl}/rooming-list`;

  getPendientes(fecha: string, soloPendientes: boolean): Observable<CheckInArrival[]> {
    const params = new HttpParams()
      .set('fecIngreso', normalizePmsDateDDMMYYYY(fecha))
      .set('soloPendientes', String(soloPendientes));

    return this.http
      .get<CheckInArrival[] | { datos?: CheckInArrival[] }>(this.apiUrl, { params })
      .pipe(
        map((response) => (Array.isArray(response) ? response : response?.datos ?? []).map((item) => this.normalizeArrival(item))),
        catchError((error) => throwError(() => error))
      );
  }

  checkIn(request: CheckInRequest): Observable<unknown> {
    return this.http.post(this.checkInUrl, {
      ...request,
      fecIngreso: normalizePmsDateDDMMYYYY(request.fecIngreso),
      fecSalida: normalizePmsDateDDMMYYYY(request.fecSalida)
    });
  }

  getRoomingList(codRsv: string, numHabita: string): Observable<RoomingListGuest[]> {
    const params = new HttpParams().set('codRsv', codRsv).set('numHabita', numHabita);
    return this.http
      .get<{ success?: boolean; data?: RoomingListGuest[] } | RoomingListGuest[]>(this.roomingListUrl, { params })
      .pipe(
        map((response) =>
          (Array.isArray(response) ? response : response?.data ?? []).map((guest) => ({
            ...guest,
            fecNaci: normalizePmsDateDDMMYYYY(guest.fecNaci)
          }))
        )
      );
  }

  addRoomingListGuest(request: RoomingListSaveRequest): Observable<RoomingListMutationResponse> {
    return this.http.post<RoomingListMutationResponse>(this.roomingListUrl, { ...request, fecNac: normalizePmsDateDDMMYYYY(request.fecNac) });
  }

  updateRoomingListGuest(request: RoomingListSaveRequest): Observable<RoomingListMutationResponse | string> {
    return this.http.put<RoomingListMutationResponse>(this.roomingListUrl, { ...request, fecNac: normalizePmsDateDDMMYYYY(request.fecNac) });
  }

  deleteRoomingListGuest(idOpe: string, codRsv: string): Observable<unknown> {
    return this.http.delete(this.roomingListUrl, { body: { idOpe, codRsv } });
  }

  private normalizeArrival(arrival: CheckInArrival): CheckInArrival {
    return {
      ...arrival,
      fechaIng: normalizePmsDateDDMMYYYY(arrival.fechaIng),
      fechaSal: normalizePmsDateDDMMYYYY(arrival.fechaSal)
    };
  }
}
