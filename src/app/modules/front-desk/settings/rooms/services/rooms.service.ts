import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { Room } from '../models/room.model';
import { RoomRequest } from '../models/room-request.model';

interface RoomCleaningRequest {
  clean: string;
}

@Injectable({ providedIn: 'root' })
export class RoomsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/habitacion`;

  getRooms(): Observable<Room[]> {
    return this.http.get<Room[] | Room>(this.apiUrl).pipe(map((response) => this.normalizeRoomResponse(response)));
  }

  getRoomsByCategory(categoria: string): Observable<Room[]> {
    return this.http
      .get<Room[] | Room>(`${this.apiUrl}/categoria/${encodeURIComponent(categoria)}`)
      .pipe(map((response) => this.normalizeRoomResponse(response)));
  }

  createRoom(request: RoomRequest): Observable<RoomRequest> {
    return this.http.post<RoomRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateRoom(habitacion: number, request: RoomRequest): Observable<RoomRequest> {
    return this.http.put<RoomRequest>(`${this.apiUrl}/${encodeURIComponent(String(habitacion))}`, { ...request, proceso: 2 });
  }

  deleteRoom(habitacion: number): Observable<RoomRequest> {
    return this.http.delete<RoomRequest>(`${this.apiUrl}/${encodeURIComponent(String(habitacion))}`);
  }

  updateCleaning(habitacion: number, clean: string): Observable<RoomCleaningRequest> {
    return this.http.patch<RoomCleaningRequest>(`${this.apiUrl}/${encodeURIComponent(String(habitacion))}/limpieza`, { clean });
  }

  updateAllCleaning(clean: string): Observable<RoomCleaningRequest> {
    return this.http.patch<RoomCleaningRequest>(`${this.apiUrl}/limpieza/todas`, { clean });
  }

  private normalizeRoomResponse(response: Room[] | Room | null): Room[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : [response];
  }
}
