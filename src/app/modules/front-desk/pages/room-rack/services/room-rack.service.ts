import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { RoomRackRoom } from '../models/room-rack-room.model';

export interface RoomBlockRequest {
  proceso               : number;
  numeroHabitacion      : number;
  categoriaHabitacion   : string;
  descripcionHabitacion : string;
  fechaInicial          : string;
  fechaFin              : string;
  descripcion           : string;
  observaciones         : string;
  operador              : string;
  respuesta             : string;
}

@Injectable({ providedIn: 'root' })
export class RoomRackService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/estadohabitacion`;
  private readonly habitacionApiUrl = `${environment.apiUrl}/habitacion`;
  private readonly bloqueoHabitacionApiUrl = `${environment.apiUrl}/bloqueo-habitacion`;

  getAllRoomsStatus(fecha: string): Observable<RoomRackRoom[]> {
    const params = new HttpParams().set('fecha', normalizePmsDateDDMMYYYY(fecha));

    return this.http
      .get<RoomRackRoom[] | RoomRackRoom>(`${this.apiUrl}/todas`, { params })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  updateRoomCleanStatus(roomNumber: number | string, clean: 'L' | 'S'): Observable<unknown> {
    return this.http.patch(`${this.habitacionApiUrl}/${encodeURIComponent(String(roomNumber))}/limpieza`, { clean });
  }

  blockRoom(payload: RoomBlockRequest): Observable<unknown> {
    return this.http.post(this.bloqueoHabitacionApiUrl, {
      ...payload,
      fechaInicial: normalizePmsDateDDMMYYYY(payload.fechaInicial),
      fechaFin: normalizePmsDateDDMMYYYY(payload.fechaFin)
    });
  }

  private normalizeResponse(response: RoomRackRoom[] | RoomRackRoom | null): RoomRackRoom[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [response];
  }
}
