import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { PoliticaHojaRegistro, PoliticasResponse, RegistrationSheetLanguage } from '../models/politica-hoja-registro.model';

@Injectable({ providedIn: 'root' })
export class PoliticasHojaRegistroService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/frontdesk/politicas-hoja-registro/activas`;

  getActive(language: RegistrationSheetLanguage): Observable<PoliticaHojaRegistro[]> {
    const params = new HttpParams().set('idioma', language);

    return this.http.get<PoliticasResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        if (!response?.success) {
          throw new Error(response?.message || 'No se pudieron cargar las políticas de la hoja de registro.');
        }
        return [...(response.data ?? [])].sort((a, b) => a.orden - b.orden);
      })
    );
  }
}
