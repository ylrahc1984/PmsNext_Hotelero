import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  CambioFormaPagoPayload,
  CambioFormaPagoResponse,
  DocumentoDetalleResponse
} from '../pages-factura/documento-detalle/documento-detalle.interface';

@Injectable({ providedIn: 'root' })
export class DocumentoDetalleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/documentos-facturados/detalle`;
  private readonly pdfUrl = `${environment.apiUrl}/facturas`;
  private readonly cambioFormaPagoUrl = `${environment.apiUrl}/cambio-forma-pago`;

  getDetalle(tipoDocu: string, serieDocu: string, numDocu: string, operador: string): Observable<DocumentoDetalleResponse> {
    const params = new HttpParams()
      .set('tipDocu', tipoDocu.trim())
      .set('serieDocu', (serieDocu || '000').trim())
      .set('numDocu', numDocu.trim())
      .set('operador', operador.trim());

    return this.http.get<DocumentoDetalleResponse>(this.apiUrl, { params }).pipe(
      map((response) => response),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al cargar el detalle del documento';
        return throwError(() => new Error(message));
      })
    );
  }

  getPdf(tipoDocu: string, serie: string, consecutivo: string): Observable<Blob> {
    const safeTipo = encodeURIComponent(tipoDocu);
    const safeSerie = encodeURIComponent(serie || '000');
    const safeConsecutivo = encodeURIComponent(consecutivo);
    const url = `${this.pdfUrl}/${safeTipo}/${safeSerie}/${safeConsecutivo}/pdf`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al obtener el PDF del documento';
        return throwError(() => new Error(message));
      })
    );
  }

  cambiarFormaPago(payload: CambioFormaPagoPayload): Observable<CambioFormaPagoResponse> {
    return this.http.post<CambioFormaPagoResponse>(this.cambioFormaPagoUrl, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo cambiar la forma de pago.';
        return throwError(() => new Error(message));
      })
    );
  }
}
