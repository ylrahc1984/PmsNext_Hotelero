import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  OrdenPedidoCreatePayload,
  OrdenPedidoCreateResponse,
  OrdenPedidoFiltro,
  OrdenPedidoListadoItem,
  OrdenPedidoListadoResponse
} from '../interfaces/orden-pedido.interface';

type ApiRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class OrdenPedidoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/nota-pedido`;

  getOrdenes(filters: OrdenPedidoFiltro): Observable<OrdenPedidoListadoResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(filters.pageNumber))
      .set('pageSize', String(filters.pageSize));

    const tipOrden = this.clean(filters.tipOrden);
    const fechaDesde = this.formatDateForApi(filters.fechaDesde);
    const fechaHasta = this.formatDateForApi(filters.fechaHasta);
    const nomCliente = this.clean(filters.nomCliente);

    if (tipOrden) {
      params = params.set('tipOrden', tipOrden);
    }
    if (fechaDesde) {
      params = params.set('fechaDesde', fechaDesde);
    }
    if (fechaHasta) {
      params = params.set('fechaHasta', fechaHasta);
    }
    if (nomCliente) {
      params = params.set('nomCliente', nomCliente);
    }

    return this.http.get<{ datos?: unknown; paginacion?: unknown }>(`${this.apiUrl}/listaOrdenPedido`, { params }).pipe(
      map((response) => {
        const datos = this.normalizeArray(response?.datos).map((item) => this.mapListadoItem(item));
        const paginacion = this.extractRecord(response?.paginacion);
        const totalRegistros =
          this.readNumber(paginacion, 'totalRegistros', 'total', 'totalRows', 'recordsTotal') || datos.length;
        const paginaActual =
          this.readNumber(paginacion, 'paginaActual', 'pageNumber', 'page', 'currentPage') || filters.pageNumber;
        const pageSize = this.readNumber(paginacion, 'pageSize', 'registrosPorPagina', 'size') || filters.pageSize;
        const totalPaginas =
          this.readNumber(paginacion, 'totalPaginas', 'pageCount', 'totalPages') ||
          (totalRegistros > 0 ? Math.ceil(totalRegistros / pageSize) : 1);

        return {
          datos,
          paginacion: {
            totalRegistros,
            paginaActual,
            pageSize,
            totalPaginas
          }
        };
      }),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudieron cargar las ordenes de pedido.';
        return throwError(() => new Error(message));
      })
    );
  }

  crearOrden(payload: OrdenPedidoCreatePayload): Observable<OrdenPedidoCreateResponse> {
    return this.http.post(`${this.apiUrl}/crear`, payload, { responseType: 'text' }).pipe(
      map((response) => this.parseCreateResponse(response)),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo crear la orden.';
        return throwError(() => new Error(message));
      })
    );
  }

  private mapListadoItem(item: ApiRecord): OrdenPedidoListadoItem {
    return {
      tipOrden: this.readString(item, 'PPV05_TipNDP', 'tipOrden', 'tipo'),
      serie: this.readString(item, 'PPV05_SerieNDP', 'serie', 'serieNDP'),
      numero: this.readString(item, 'PPV05_NumNDP', 'numero', 'numeroNDP'),
      fecha: this.readString(item, 'PPV05_FecDocu', 'fecha', 'fecNDP'),
      cliente: this.readString(item, 'PPV05_NomCliente', 'nomCliente', 'cliente'),
      ruc: this.readString(item, 'PPV05_RucCliente', 'rucCliente', 'ruc'),
      subtotal: this.readNumber(item, 'PPV05_SubTotal', 'subTotal', 'subtotal'),
      impuesto: this.readNumber(item, 'PPV05_Impuesto', 'impuesto'),
      total: this.readNumber(item, 'PPV05_TotalDocu', 'totDocu', 'total'),
      estado: this.readString(item, 'PPV05_EstDocu', 'estado'),
      items: this.readNumber(item, 'PPV05_Items', 'items', 'cantidadItems'),
      observaciones: this.readString(item, 'PPV05_Observaciones', 'observaciones'),
      operador: this.readString(item, 'PPV05_Operador', 'operador', 'usuario')
    };
  }

  private parseCreateResponse(response: string): OrdenPedidoCreateResponse {
    const text = (response ?? '').toString().trim();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as OrdenPedidoCreateResponse;
    } catch {
      return { respuesta: text };
    }
  }

  private normalizeArray(source: unknown): ApiRecord[] {
    if (!Array.isArray(source)) {
      return [];
    }
    return source.filter((item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item));
  }

  private extractRecord(source: unknown): ApiRecord {
    if (Array.isArray(source)) {
      const first = source.find((item) => !!item && typeof item === 'object' && !Array.isArray(item));
      return (first as ApiRecord) ?? {};
    }
    if (source && typeof source === 'object') {
      return source as ApiRecord;
    }
    return {};
  }

  private readString(record: ApiRecord, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (value === null || value === undefined) {
        continue;
      }
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  private readNumber(record: ApiRecord, ...keys: string[]): number {
    for (const key of keys) {
      const raw = record[key];
      const value = Number(raw);
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return 0;
  }

  private clean(value: unknown): string {
    return String(value ?? '').trim();
  }

  private formatDateForApi(value: unknown): string {
    const raw = this.clean(value);
    if (!raw) {
      return '';
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    return raw;
  }
}
