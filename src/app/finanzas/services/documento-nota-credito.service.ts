import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { DocumentoNotaCredito } from 'src/app/finanzas/nota-credito/interfaces/documento-nota-credito.interface';

type DocumentoNotaCreditoResponse = DocumentoNotaCredito[] | { data?: DocumentoNotaCredito[]; datos?: DocumentoNotaCredito[] };

@Injectable({ providedIn: 'root' })
export class DocumentoNotaCreditoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/documento/notac`;

  getTipos(proceso: number): Observable<DocumentoNotaCredito[]> {
    const url = `${this.apiUrl}/${encodeURIComponent(String(proceso))}`;
    return this.http.get<DocumentoNotaCreditoResponse>(url).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response?.data ?? response?.datos ?? [];
        return Array.isArray(data) ? data : [];
      }),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'Error al cargar tipos de nota de crédito';
        return throwError(() => new Error(message));
      })
    );
  }
}
