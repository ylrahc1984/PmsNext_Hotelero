import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { PaxType } from '../models/pax-type.model';
import { PaxTypeRequest } from '../models/pax-type-request.model';
import { PaxTypeResponse } from '../models/pax-type-response.model';

@Injectable({ providedIn: 'root' })
export class PaxTypesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tipo-pax`;

  getPaxTypes(): Observable<PaxType[]> {
    return this.http.get<PaxTypeResponse | null>(this.apiUrl).pipe(map((response) => response?.datos ?? []));
  }

  createPaxType(request: PaxTypeRequest): Observable<PaxTypeRequest> {
    return this.http.post<PaxTypeRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updatePaxType(codigo: string, request: PaxTypeRequest): Observable<PaxTypeRequest> {
    return this.http.put<PaxTypeRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  deletePaxType(codigo: string): Observable<PaxTypeRequest> {
    return this.http.delete<PaxTypeRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }
}
