import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { Nationality } from '../models/nationality.model';
import { NationalityRequest } from '../models/nationality-request.model';

type NationalityResponse = Nationality[] | Nationality | { datos?: Nationality[] | Nationality };

@Injectable({ providedIn: 'root' })
export class NationalitiesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/nacionalidad`;

  getNationalities(): Observable<Nationality[]> {
    return this.http.get<NationalityResponse>(this.apiUrl).pipe(map((response) => this.normalizeResponse(response)));
  }

  searchByCode(term: string): Observable<Nationality[]> {
    const params = this.buildSearchParams('codigo', term);
    return this.http
      .get<NationalityResponse>(`${this.apiUrl}/buscar/codigo`, { params })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  searchByDescription(term: string): Observable<Nationality[]> {
    const params = this.buildSearchParams('descripcion', term);
    return this.http
      .get<NationalityResponse>(`${this.apiUrl}/buscar/descripcion`, { params })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  createNationality(request: NationalityRequest): Observable<NationalityRequest> {
    return this.http.post<NationalityRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateNationality(codigo: string, request: NationalityRequest): Observable<NationalityRequest> {
    return this.http.put<NationalityRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  deleteNationality(codigo: string): Observable<NationalityRequest> {
    return this.http.delete<NationalityRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }

  private buildSearchParams(paramName: 'codigo' | 'descripcion', term: string): HttpParams {
    const sanitizedTerm = term.trim();

    if (!sanitizedTerm) {
      return new HttpParams();
    }

    return new HttpParams().set(paramName, sanitizedTerm).set('term', sanitizedTerm).set('q', sanitizedTerm);
  }

  private normalizeResponse(response: NationalityResponse | null | undefined): Nationality[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    const possibleWrappedResponse = response as { datos?: Nationality[] | Nationality };
    if (possibleWrappedResponse.datos !== undefined) {
      const datos = possibleWrappedResponse.datos;
      if (!datos) {
        return [];
      }

      return Array.isArray(datos) ? datos : [datos];
    }

    return [response as Nationality];
  }
}
