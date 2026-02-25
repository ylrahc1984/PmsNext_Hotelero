import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { MotivoAnulacion } from 'src/app/finanzas/nota-credito/interfaces/motivo-anulacion.interface';

type MotivoAnulacionResponse = MotivoAnulacion[] | { data?: MotivoAnulacion[]; datos?: MotivoAnulacion[] };

@Injectable({ providedIn: 'root' })
export class MotivoAnulacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/MotivoAnulacion`;

  getMotivos(proceso: number): Observable<MotivoAnulacion[]> {
    const params = new HttpParams().set('proceso', String(proceso));
    return this.http.get<MotivoAnulacionResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response?.data ?? response?.datos ?? [];
        return Array.isArray(data) ? data : [];
      }),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al cargar motivos de anulación';
        return throwError(() => new Error(message));
      })
    );
  }
}
