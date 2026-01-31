import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { IdiomaDto } from './idiomas.models';

@Injectable({ providedIn: 'root' })
export class IdiomasService {
  private apiUrl = `${environment.apiUrl}/idiomas`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<IdiomaDto[]> {
    return this.http.get<IdiomaDto[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).filter((i) => !!i))
    );
  }

  getById(idIdioma: number): Observable<IdiomaDto | null> {
    return this.http.get<IdiomaDto[] | IdiomaDto>(`${this.apiUrl}/${idIdioma}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        return item ?? null;
      })
    );
  }
}

