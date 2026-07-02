import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { RoomGroup } from '../models/room-group.model';
import { RoomGroupRequest } from '../models/room-group-request.model';

@Injectable({ providedIn: 'root' })
export class RoomGroupsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/grupohabitacion`;

  getRoomGroups(): Observable<RoomGroup[]> {
    return this.http.get<RoomGroup[] | RoomGroup>(this.apiUrl).pipe(
      map((response) => {
        if (!response) {
          return [];
        }

        return Array.isArray(response) ? response : [response];
      })
    );
  }

  createRoomGroup(payload: RoomGroupRequest): Observable<RoomGroupRequest> {
    return this.http.post<RoomGroupRequest>(this.apiUrl, { ...payload, proceso: 1 });
  }

  updateRoomGroup(codigo: string, payload: RoomGroupRequest): Observable<RoomGroupRequest> {
    return this.http.put<RoomGroupRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...payload, proceso: 2 });
  }

  deleteRoomGroup(codigo: string): Observable<RoomGroupRequest> {
    return this.http.delete<RoomGroupRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }
}
