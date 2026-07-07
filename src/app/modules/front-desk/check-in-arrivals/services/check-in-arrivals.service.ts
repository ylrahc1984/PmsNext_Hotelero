import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import { CheckInArrival } from '../models/check-in-arrival.model';

@Injectable({ providedIn: 'root' })
export class CheckInArrivalsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/checkin/pendientes`;

  getPendientes(fecha: string, soloPendientes: boolean): Observable<CheckInArrival[]> {
    const params = new HttpParams()
      .set('fecIngreso', fecha)
      .set('soloPendientes', String(soloPendientes));

    return this.http
      .get<CheckInArrival[] | { datos?: CheckInArrival[] }>(this.apiUrl, { params })
      .pipe(
        map((response) => (Array.isArray(response) ? response : response?.datos ?? [])),
        catchError((error) => throwError(() => error))
      );
  }
}
