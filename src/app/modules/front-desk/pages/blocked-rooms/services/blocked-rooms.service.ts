import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';

export interface BlockedRoomApi {
  CR08_Room: number;
  CR08_CateHab: string;
  CR08_DescHabita: string;
  CR08_FechaIni: string;
  CR08_FechaFin: string;
  CR08_Descripcion: string;
  CR08_Observaciones: string;
  CR08_Operador: string;
}

export interface BlockedRoom {
  roomNumber: number;
  categoryCode: string;
  roomDescription: string;
  startDate: string;
  endDate: string;
  description: string;
  observations: string;
  operator: string;
}

export interface CreateBlockedRoomRequest {
  roomNumber: number;
  categoryCode: string;
  roomDescription: string;
  startDate: string;
  endDate: string;
  description: string;
  observations: string;
  operator: string;
}

@Injectable({ providedIn: 'root' })
export class BlockedRoomsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/bloqueo-habitacion`;

  getBlockedRooms(): Observable<BlockedRoom[]> {
    return this.http
      .get<BlockedRoomApi[] | BlockedRoomApi | null>(this.apiUrl)
      .pipe(map((response) => this.normalizeListResponse(response).map((item) => this.mapApiToModel(item))));
  }

  createBlockedRoom(request: CreateBlockedRoomRequest): Observable<unknown> {
    return this.http.post(this.apiUrl, {
      proceso: 1,
      numeroHabitacion: request.roomNumber,
      categoriaHabitacion: request.categoryCode,
      descripcionHabitacion: request.roomDescription,
      fechaInicial: normalizePmsDateDDMMYYYY(request.startDate),
      fechaFin: normalizePmsDateDDMMYYYY(request.endDate),
      descripcion: request.description,
      observaciones: request.observations,
      operador: request.operator,
      respuesta: ''
    });
  }

  extendBlockedRoom(room: BlockedRoom, newEndDate: string, observations: string, operator: string): Observable<unknown> {
    const roomNumber = Number.isFinite(room.roomNumber) ? Math.trunc(room.roomNumber) : 0;

    return this.http.put(`${this.apiUrl}/3`, {
      proceso: 3,
      numeroHabitacion: roomNumber,
      categoriaHabitacion: room.categoryCode,
      descripcionHabitacion: room.roomDescription,
      fechaInicial: normalizePmsDateDDMMYYYY(room.startDate),
      fechaFin: normalizePmsDateDDMMYYYY(newEndDate),
      descripcion: room.description,
      observaciones: observations,
      operador: operator,
      respuesta: ''
    });
  }

  unlockBlockedRoom(room: BlockedRoom, operator: string): Observable<unknown> {
    const roomNumber = Number.isFinite(room.roomNumber) ? Math.trunc(room.roomNumber) : 0;
    const params = new HttpParams().set('operador', operator);

    return this.http.delete(`${this.apiUrl}/${roomNumber}`, { params }).pipe(catchError((error) => throwError(() => error)));
  }

  private normalizeListResponse(response: BlockedRoomApi[] | BlockedRoomApi | null): BlockedRoomApi[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [response];
  }

  private mapApiToModel(item: BlockedRoomApi): BlockedRoom {
    return {
      roomNumber: item.CR08_Room,
      categoryCode: item.CR08_CateHab,
      roomDescription: item.CR08_DescHabita,
      startDate: normalizePmsDateDDMMYYYY(item.CR08_FechaIni),
      endDate: normalizePmsDateDDMMYYYY(item.CR08_FechaFin),
      description: item.CR08_Descripcion,
      observations: item.CR08_Observaciones,
      operator: item.CR08_Operador
    };
  }
}
