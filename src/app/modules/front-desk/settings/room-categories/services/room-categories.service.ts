import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { RoomCategory } from '../models/room-category.model';
import { RoomCategoryRequest } from '../models/room-category-request.model';

@Injectable({ providedIn: 'root' })
export class RoomCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categoriahabitacion`;

  getRoomCategories(): Observable<RoomCategory[]> {
    return this.http.get<RoomCategory[] | RoomCategory>(this.apiUrl).pipe(
      map((response) => {
        if (!response) {
          return [];
        }

        return Array.isArray(response) ? response : [response];
      })
    );
  }

  createRoomCategory(request: RoomCategoryRequest): Observable<RoomCategoryRequest> {
    return this.http.post<RoomCategoryRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateRoomCategory(codigo: string, request: RoomCategoryRequest): Observable<RoomCategoryRequest> {
    return this.http.put<RoomCategoryRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  deleteRoomCategory(codigo: string): Observable<RoomCategoryRequest> {
    return this.http.delete<RoomCategoryRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }
}
