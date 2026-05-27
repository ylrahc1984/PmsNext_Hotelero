import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class FacturacionDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/facturacion/documentos`;

  descargarPdf(tipo: string, serie: string, numero: string): Observable<HttpResponse<Blob>> {
    return this.getDocumentoBlob('pdf', tipo, serie, numero, 'Error al obtener el PDF del documento');
  }

  descargarXmlFirmado(tipo: string, serie: string, numero: string): Observable<HttpResponse<Blob>> {
    return this.getDocumentoBlob('xml-firmado', tipo, serie, numero, 'Error al obtener el XML firmado');
  }

  descargarXmlRespuesta(tipo: string, serie: string, numero: string): Observable<HttpResponse<Blob>> {
    return this.getDocumentoBlob('xml-respuesta', tipo, serie, numero, 'Error al obtener el XML de respuesta');
  }

  private getDocumentoBlob(
    recurso: string,
    tipo: string,
    serie: string,
    numero: string,
    fallback: string
  ): Observable<HttpResponse<Blob>> {
    const safeTipo = encodeURIComponent(tipo);
    const safeSerie = encodeURIComponent(serie || '000');
    const safeNumero = encodeURIComponent(numero);
    const url = `${this.apiUrl}/${recurso}/${safeTipo}/${safeSerie}/${safeNumero}`;

    return this.http.get(url, { observe: 'response', responseType: 'blob' }).pipe(
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || fallback;
        return throwError(() => new Error(message));
      })
    );
  }
}
