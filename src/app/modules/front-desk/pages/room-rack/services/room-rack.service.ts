import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { RoomRackRoom } from '../models/room-rack-room.model';

@Injectable({ providedIn: 'root' })
export class RoomRackService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/estadohabitacion`;

  getAllRoomsStatus(fecha: string): Observable<RoomRackRoom[]> {
    const params = new HttpParams().set('fecha', fecha);

    return this.http
      .get<RoomRackRoom[] | RoomRackRoom>(`${this.apiUrl}/todas`, { params })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: RoomRackRoom[] | RoomRackRoom | null): RoomRackRoom[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [response];
  }
}
