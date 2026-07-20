import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  CierreDiarioValidacionResponse,
  EjecutarCierreDiarioRequest,
  EjecutarCierreDiarioResponse
} from './cierre-diario.model';

@Injectable({ providedIn: 'root' })
export class CierreDiarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/cierre-diario`;

  validar(fecha: string): Observable<CierreDiarioValidacionResponse> {
    const params = new HttpParams().set('fecha', fecha.trim());

    return this.http.get<CierreDiarioValidacionResponse>(`${this.apiUrl}/validar`, { params }).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.isValidationResponse(error.error)) {
          return of(error.error);
        }
        return throwError(() => error);
      })
    );
  }

  ejecutar(request: EjecutarCierreDiarioRequest): Observable<EjecutarCierreDiarioResponse> {
    const params = new HttpParams()
      .set('empresa', request.empresa.trim())
      .set('operador', request.operador.trim());

    return this.http.post<EjecutarCierreDiarioResponse>(`${this.apiUrl}/ejecutar`, null, { params });
  }

  private isValidationResponse(value: unknown): value is CierreDiarioValidacionResponse {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const response = value as Partial<CierreDiarioValidacionResponse>;
    return typeof response.success === 'boolean' && !!response.data && Array.isArray(response.data.detalles);
  }
}
