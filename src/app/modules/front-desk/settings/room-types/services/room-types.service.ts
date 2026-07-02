import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { RoomType } from '../models/room-type.model';
import { RoomTypeRequest } from '../models/room-type-request.model';

@Injectable({ providedIn: 'root' })
export class RoomTypesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tipohabitacion`;

  getRoomTypesByCategory(codCategoria: string): Observable<RoomType[]> {
    return this.http.get<RoomType[] | RoomType>(`${this.apiUrl}/categoria/${encodeURIComponent(codCategoria)}`).pipe(
      map((response) => {
        if (!response) {
          return [];
        }

        return Array.isArray(response) ? response : [response];
      })
    );
  }

  getRoomType(codTipo: string, codCate: string): Observable<RoomType | null> {
    return this.http
      .get<RoomType | RoomType[] | null>(`${this.apiUrl}/${encodeURIComponent(codTipo)}/categoria/${encodeURIComponent(codCate)}`)
      .pipe(
        map((response) => {
          if (!response) {
            return null;
          }

          return Array.isArray(response) ? response[0] ?? null : response;
        })
      );
  }

  createRoomType(request: RoomTypeRequest): Observable<RoomTypeRequest> {
    return this.http.post<RoomTypeRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateRoomType(codTipo: string, codCate: string, request: RoomTypeRequest): Observable<RoomTypeRequest> {
    return this.http.put<RoomTypeRequest>(
      `${this.apiUrl}/${encodeURIComponent(codTipo)}/categoria/${encodeURIComponent(codCate)}`,
      { ...request, proceso: 2 }
    );
  }

  deleteRoomType(codTipo: string, codCate: string): Observable<RoomTypeRequest> {
    return this.http.delete<RoomTypeRequest>(`${this.apiUrl}/${encodeURIComponent(codTipo)}/categoria/${encodeURIComponent(codCate)}`);
  }
}
