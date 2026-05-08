import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  private readonly apiUrl = `${environment.apiUrl}/facturacion/consultar`;
  private readonly pdfUrl = `${environment.apiUrl}/facturas`;
  private readonly cambioFormaPagoUrl = `${environment.apiUrl}/cambio-forma-pago`;

  getDetalle(tipoDocu: string, serie: string, numero: string): Observable<DocumentoDetalleResponse> {
    const safeTipo = encodeURIComponent(tipoDocu);
    const safeSerie = encodeURIComponent(serie || '000');
    const safeNumero = encodeURIComponent(numero);
    const url = `${this.apiUrl}/${safeTipo}/${safeSerie}/${safeNumero}`;
    return this.http.get<DocumentoDetalleResponse>(url).pipe(
      map((response) => response ?? {}),
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
