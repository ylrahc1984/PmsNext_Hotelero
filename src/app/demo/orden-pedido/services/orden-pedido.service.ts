import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import {
  CambioFormaPagoPedidoPayload,
  CambioFormaPagoPedidoResponse,
  OrdenPedidoCompletaCliente,
  OrdenPedidoCompletaDetalleItem,
  OrdenPedidoCompletaEncabezado,
  OrdenPedidoCompletaFormaPago,
  OrdenPedidoCompletaResponse,
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
  private readonly cambioFormaPagoPedidoUrl = `${environment.apiUrl}/cambio-forma-pago-pedido`;

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

  anularOrden(tipOrden: string, serie: string, numero: string): Observable<{ respuesta?: string }> {
    const tip = this.clean(tipOrden);
    const normalizedSerie = this.clean(serie) || '000';
    const normalizedNumero = this.clean(numero);

    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(tip)}/${encodeURIComponent(`${normalizedSerie}-${normalizedNumero}`)}`, {
        responseType: 'text'
      })
      .pipe(
        map((response) => this.parseCreateResponse(response)),
        catchError((error: HttpErrorResponse) => {
          const message = error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo anular la orden.';
          return throwError(() => new Error(message));
        })
      );
  }

  getOrdenCompleta(tipNDP: string, serieNDP: string, numNDP: string): Observable<OrdenPedidoCompletaResponse> {
    const tip = this.clean(tipNDP);
    const serie = this.clean(serieNDP) || '000';
    const numero = this.clean(numNDP);

    return this.http
      .get<{ encabezado?: unknown; detalle?: unknown; formasPago?: unknown; cliente?: unknown }>(
        `${this.apiUrl}/${encodeURIComponent(tip)}/${encodeURIComponent(serie)}/${encodeURIComponent(numero)}/completa`
      )
      .pipe(
        map((response) => ({
          encabezado: this.mapEncabezadoCompleto(this.extractRecord(response?.encabezado)),
          detalle: this.normalizeArray(response?.detalle).map((item) => this.mapDetalleCompleto(item)),
          formasPago: this.normalizeArray(response?.formasPago).map((item) => this.mapFormaPagoCompleta(item)),
          cliente: this.mapClienteCompleto(this.extractRecord(response?.cliente))
        })),
        catchError((error: HttpErrorResponse) => {
          const message =
            error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo cargar el detalle de la orden.';
          return throwError(() => new Error(message));
        })
      );
  }

  cambiarFormaPagoPedido(payload: CambioFormaPagoPedidoPayload): Observable<CambioFormaPagoPedidoResponse> {
    return this.http.post<CambioFormaPagoPedidoResponse>(this.cambioFormaPagoPedidoUrl, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo cambiar la forma de pago del pedido.';
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

  private mapEncabezadoCompleto(raw: ApiRecord): OrdenPedidoCompletaEncabezado | null {
    if (!Object.keys(raw).length) {
      return null;
    }

    return {
      tipNDP: this.readString(raw, 'ppV05_TipNDP', 'PPV05_TipNDP'),
      serieNDP: this.readString(raw, 'ppV05_SerieNDP', 'PPV05_SerieNDP'),
      numNDP: this.readString(raw, 'ppV05_NumNDP', 'PPV05_NumNDP'),
      puntoVenta: this.readString(raw, 'ppV05_PntVenta', 'PPV05_PntVenta'),
      fechaDocumento: this.readString(raw, 'ppV05_FecDocu', 'PPV05_FecDocu'),
      horaDocumento: this.readString(raw, 'ppV05_HorDocu', 'PPV05_HorDocu'),
      codVendedor: this.readString(raw, 'ppV05_CodVendedor', 'PPV05_CodVendedor'),
      codCliente: this.readString(raw, 'ppV05_CodCliente', 'PPV05_CodCliente'),
      rucCliente: this.readString(raw, 'ppV05_RucCliente', 'PPV05_RucCliente'),
      nomCliente: this.readString(raw, 'ppV05_NomCliente', 'PPV05_NomCliente'),
      dirCliente: this.readString(raw, 'ppV05_DirCliente', 'PPV05_DirCliente'),
      subtotal: this.readNumber(raw, 'ppV05_SubTotal', 'PPV05_SubTotal'),
      impuesto: this.readNumber(raw, 'ppV05_Impuesto', 'PPV05_Impuesto'),
      totalDocumento: this.readNumber(raw, 'ppV05_TotalDocu', 'PPV05_TotalDocu'),
      totalPago: this.readNumber(raw, 'ppV05_TotalPago', 'PPV05_TotalPago'),
      estadoDocumento: this.readString(raw, 'ppV05_EstDocu', 'PPV05_EstDocu'),
      moneda: this.readString(raw, 'ppV05_Moneda', 'PPV05_Moneda'),
      tipoCambio: this.readNumber(raw, 'ppV05_TCambio', 'PPV05_TCambio'),
      fechaVencimiento: this.readString(raw, 'ppV05_FechaVen', 'PPV05_FechaVen'),
      listaPrecio: this.readString(raw, 'ppV05_LPrecio', 'PPV05_LPrecio'),
      items: this.readNumber(raw, 'ppV05_Items', 'PPV05_Items'),
      referencia: this.readString(raw, 'ppV05_NReferencia', 'PPV05_NReferencia'),
      observaciones: this.readString(raw, 'ppV05_Observaciones', 'PPV05_Observaciones'),
      operador: this.readString(raw, 'ppV05_Operador', 'PPV05_Operador'),
      idBee: this.readString(raw, 'ppV05_IdBee', 'PPV05_IdBee'),
      codActividad: this.readString(raw, 'ppV05_CActividad', 'PPV05_CActividad')
    };
  }

  private mapDetalleCompleto(raw: ApiRecord): OrdenPedidoCompletaDetalleItem {
    return {
      orden: this.readNumber(raw, 'ppV06_Orden', 'PPV06_Orden'),
      codProducto: this.readString(raw, 'ppV06_CodProducto', 'PPV06_CodProducto'),
      nomProducto: this.readString(raw, 'ppV06_NomProducto', 'PPV06_NomProducto'),
      categoria: this.readString(raw, 'ppV06_Categoria', 'PPV06_Categoria'),
      cantidad: this.readNumber(raw, 'ppV06_Cantidad', 'PPV06_Cantidad'),
      unidadMedida: this.readString(raw, 'ppV06_UMedida', 'PPV06_UMedida'),
      precioUnitarioLista: this.readNumber(raw, 'ppV06_PUndLst', 'PPV06_PUndLst'),
      unitarioSinImpuesto: this.readNumber(raw, 'ppV06_UniSinImp', 'PPV06_UniSinImp'),
      subtotalSinImpuesto: this.readNumber(raw, 'ppV06_PrecioSinImp', 'PPV06_PrecioSinImp'),
      porcentajeDescuento: this.readNumber(raw, 'ppV06_PorDescu', 'PPV06_PorDescu'),
      descuento: this.readNumber(raw, 'ppV06_Descuento', 'PPV06_Descuento'),
      totalNeto: this.readNumber(raw, 'ppV06_TotalNeto', 'PPV06_TotalNeto'),
      porcentajeImpuesto: this.readNumber(raw, 'ppV06_PorImpuesto', 'PPV06_PorImpuesto'),
      impuesto: this.readNumber(raw, 'ppV06_Impuestos', 'PPV06_Impuestos'),
      unitarioConImpuesto: this.readNumber(raw, 'ppV06_UniConImp', 'PPV06_UniConImp'),
      totalLinea: this.readNumber(raw, 'ppV06_Precio', 'PPV06_Precio'),
      moneda: this.readString(raw, 'ppV06_Moneda', 'PPV06_Moneda'),
      tipoCambio: this.readNumber(raw, 'ppV06_TCambio', 'PPV06_TCambio'),
      almacen: this.readString(raw, 'ppV06_Almacen', 'PPV06_Almacen')
    };
  }

  private mapFormaPagoCompleta(raw: ApiRecord): OrdenPedidoCompletaFormaPago {
    return {
      orden: this.readNumber(raw, 'ppV07_Orden', 'PPV07_Orden'),
      formaPago: this.readString(raw, 'ppV07_FrmPago', 'PPV07_FrmPago'),
      tipo: this.readString(raw, 'ppV07_Tipo', 'PPV07_Tipo'),
      moneda: this.readString(raw, 'ppV07_Moneda', 'PPV07_Moneda'),
      monto: this.readNumber(raw, 'ppV07_Monto', 'PPV07_Monto'),
      montoOriginal: this.readNumber(raw, 'ppV07_MontoOri', 'PPV07_MontoOri'),
      tipoCambio: this.readNumber(raw, 'ppV07_TCambio', 'PPV07_TCambio'),
      referencia: this.readString(raw, 'ppV07_Referencia', 'PPV07_Referencia'),
      numeroTarjeta: this.readString(raw, 'ppV07_NumTarjeta', 'PPV07_NumTarjeta'),
      vencimiento: this.readString(raw, 'ppV07_Vencimiento', 'PPV07_Vencimiento')
    };
  }

  private mapClienteCompleto(raw: ApiRecord): OrdenPedidoCompletaCliente | null {
    if (!Object.keys(raw).length) {
      return null;
    }

    return {
      codCliente: this.readString(raw, 'mpV00_CodClien', 'MPV00_CodClien'),
      nomCliente: this.readString(raw, 'mpV00_NomClien', 'MPV00_NomClien'),
      rucCliente: this.readString(raw, 'mpV00_RucClien', 'MPV00_RucClien'),
      contacto: this.readString(raw, 'mpV00_Contacto', 'MPV00_Contacto'),
      direccion: this.readString(raw, 'mpV00_DirClien', 'MPV00_DirClien'),
      provincia: this.readString(raw, 'mpV00_PrvClien', 'MPV00_PrvClien'),
      ciudad: this.readString(raw, 'mpV00_CiuClien', 'MPV00_CiuClien'),
      pais: this.readString(raw, 'mpV00_PaiClien', 'MPV00_PaiClien'),
      email: this.readString(raw, 'mpV00_Email', 'MPV00_Email'),
      telefono1: this.readString(raw, 'mpV00_Te1Clien', 'MPV00_Te1Clien'),
      telefono2: this.readString(raw, 'mpV00_Te2Clien', 'MPV00_Te2Clien'),
      tipoCliente: this.readString(raw, 'mpV00_TipClien', 'MPV00_TipClien')
    };
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
