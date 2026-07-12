import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  ConsultaDocumentosFiltros,
  ConsultaDocumentosResponse,
  Documento,
  DocumentoFacturadoApi,
  DocumentosFacturadosApiResponse
} from '../pages-factura/consulta-documentos/consulta-documentos.interface';

@Injectable({ providedIn: 'root' })
export class ConsultaDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/documentos-facturados`;

  buscarDocumentos(filtros: ConsultaDocumentosFiltros): Observable<ConsultaDocumentosResponse> {
    let params = new HttpParams()
      .set('Proceso', String(filtros.proceso))
      .set('FechaDocu', filtros.fechaDocu)
      .set('FechaPago', filtros.fechaPago)
      .set('FechaVen', filtros.fechaVen)
      .set('Operador', filtros.operador)
      .set('PageNumber', String(filtros.pageNumber))
      .set('PageSize', String(filtros.pageSize));

    params = this.appendIfPresent(params, 'TipDocu', filtros.tipDocu);
    params = this.appendIfPresent(params, 'SerieDocu', filtros.serieDocu);
    params = this.appendIfPresent(params, 'NumDocu', filtros.numDocu);
    params = this.appendIfPresent(params, 'CodReserva', filtros.codReserva);
    params = this.appendIfPresent(params, 'CodCliente', filtros.codCliente);
    params = this.appendIfPresent(params, 'NomClie', filtros.nomClie);
    params = this.appendIfPresent(params, 'PntVenta', filtros.pntVenta);

    return this.http.get<DocumentosFacturadosApiResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        const documentos = (response.documentos ?? []).map((item) => this.mapDocumento(item));
        const pagination = response.paginacion ?? {};
        return {
          documentos,
          paginacion: {
            paginaActual: Number(pagination.paginaActual ?? filtros.pageNumber),
            tamanoPagina: Number(pagination.tamanoPagina ?? filtros.pageSize),
            totalRegistros: Number(pagination.totalRegistros ?? documentos.length),
            totalPaginas: Math.max(Number(pagination.totalPaginas ?? 0), documentos.length ? 1 : 0),
            tienePaginaAnterior: Boolean(pagination.tienePaginaAnterior),
            tienePaginaSiguiente: Boolean(pagination.tienePaginaSiguiente)
          },
          mensaje: response.mensaje ?? ''
        };
      }),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'Error al buscar documentos';
        return throwError(() => new Error(message));
      })
    );
  }

  private mapDocumento(item: DocumentoFacturadoApi): Documento {
    const estadoElectronico = item.xmlRespuesta?.trim() ? item.xmlRespuesta.trim() : item.clave?.trim() ? 'ACEPTADO' : 'PENDIENTE';
    return {
      ...item,
      PPV00_TipoDocu: item.tipoDocu ?? '',
      PPV00_Serie: '',
      PPV00_NumDocu: item.numDocu ?? '',
      PPV00_FechaDocu: item.fechaDocu ?? '',
      PPV00_NomCliente: item.nomCliente ?? '',
      PPV00_TotalDocu: Number(item.totalDocu ?? 0),
      PPV00_TotalPago: 0,
      PPV00_EstadoDocumento: item.estDocu ?? '',
      PPV15_EstadoElectronico: estadoElectronico,
      PPV00_Moneda: item.moneda ?? '',
      PPV00_UsuarioCreacion: item.operador ?? ''
    };
  }

  private appendIfPresent(params: HttpParams, key: string, value?: string): HttpParams {
    const normalized = value?.trim();
    return normalized ? params.set(key, normalized) : params;
  }
}
