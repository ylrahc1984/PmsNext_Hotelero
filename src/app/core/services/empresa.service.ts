import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { Empresa } from '../models/empresa.model';

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/empresa`;

  obtenerEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[] | { datos?: Empresa[] }>(this.apiUrl).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        return response?.datos ?? [];
      })
    );
  }
}
