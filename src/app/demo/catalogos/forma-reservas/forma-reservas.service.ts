import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { FormaReservaDto } from './forma-reservas.models';

@Injectable({ providedIn: 'root' })
export class FormaReservasService {
  private apiUrl = `${environment.apiUrl}/formareservas`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<FormaReservaDto[]> {
    return this.http.get<FormaReservaDto[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).filter((i) => !!i))
    );
  }

  getById(idFormaReservacion: number): Observable<FormaReservaDto | null> {
    return this.http.get<FormaReservaDto[] | FormaReservaDto>(`${this.apiUrl}/${idFormaReservacion}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        return item ?? null;
      })
    );
  }
}

