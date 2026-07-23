import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { Mercado } from '../models/mercado.model';

interface MercadoApiResponse {
  datos?: Mercado[];
}

@Injectable({ providedIn: 'root' })
export class MercadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/mercado`;

  getMercados(): Observable<Mercado[]> {
    return this.http.get<Mercado[] | MercadoApiResponse>(this.apiUrl).pipe(
      map((response) => {
        const mercados = Array.isArray(response) ? response : response?.datos ?? [];

        return mercados
          .filter((mercado) => Boolean(mercado?.MR02_Codigo?.trim()))
          .sort((a, b) => a.MR02_Mercado.localeCompare(b.MR02_Mercado, 'es', { sensitivity: 'base' }));
      })
    );
  }
}
