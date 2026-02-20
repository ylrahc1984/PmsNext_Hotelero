import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { ConsultaDocumentosFiltros, ConsultaDocumentosResponse } from '../pages/consulta-documentos/consulta-documentos.interface';

@Injectable({
  providedIn: 'root'
})
export class ConsultaDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/facturacion/buscar`;

  buscarDocumentos(filtros: ConsultaDocumentosFiltros): Observable<ConsultaDocumentosResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(filtros.pageNumber))
      .set('pageSize', String(filtros.pageSize));

    params = this.appendIfPresent(params, 'tipoDocu', filtros.tipoDocu);
    params = this.appendIfPresent(params, 'fechaDesde', filtros.fechaDesde);
    params = this.appendIfPresent(params, 'fechaHasta', filtros.fechaHasta);
    params = this.appendIfPresent(params, 'nombreCliente', filtros.nombreCliente);
    params = this.appendIfPresent(params, 'condicionVenta', filtros.condicionVenta);
    params = this.appendIfPresent(params, 'estadoDocu', filtros.estadoDocu);

    return this.http.get<ConsultaDocumentosResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        totalRegistros: response?.totalRegistros ?? 0,
        detalle: response?.detalle ?? []
      })),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al buscar documentos';
        return throwError(() => new Error(message));
      })
    );
  }

  private appendIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = value?.trim();
    return normalized ? params.set(key, normalized) : params;
  }
}
