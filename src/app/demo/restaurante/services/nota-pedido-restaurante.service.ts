import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface NotaPedidoRestauranteDetalleRequest {
  codConsumo: string;
  nomConsumo: string;
  grupo: string;
  categoria: string;
  cantidad: number;
  precio: number;
  total: number;
  modificar: string;
  incluido: boolean;
  exonerado: string;
  moneda: string;
  pax: number;
  tiempo: number;
  comentario: string;
  orden: number;
  operador: string;
}

export interface NotaPedidoRestauranteRequest {
  proceso: number;
  tipNp: string;
  serieNp: string;
  numNp: string;
  pntVta: string;
  codArea: string;
  numMesa: string;
  fecha: string;
  hora: string;
  codMozo: string;
  cCliente: string;
  rucCliente: string;
  nomCliente: string;
  exonerado: number;
  subtotal: number;
  impuesto: number;
  totalDoc: number;
  estado: string;
  moneda: string;
  tCambio: number;
  lPrecio: string;
  nItem: number;
  nRoom: string;
  comentario: string;
  operador: string;
  detalle: NotaPedidoRestauranteDetalleRequest[];
  respuesta: string;
}

export interface NotaPedidoRestauranteDocumento {
  TIPO: string;
  SERIE: string;
  NUMERODOC: string;
}

export interface NotaPedidoRestauranteEjecutarResponse {
  respuesta?: string;
  tablas?: NotaPedidoRestauranteDocumento[][];
}

export interface NotaPedidoRestauranteDetalle {
  ppV08_ID: number;
  ppV08_TipNDP: string;
  ppV08_SerieNDP: string;
  ppV08_NumNDP: string;
  ppV08_CodProducto: string;
  ppV08_NomProducto: string;
  ppV08_Grupo: string;
  ppV08_Categoria: string;
  ppV08_UMedida: string;
  ppV08_Cantidad: number;
  ppV08_UniConImp: number;
  ppV08_PrecioSinImp: number;
  ppV08_UniSinImp: number;
  ppV08_Descuento: number;
  ppV08_PorDescu: number;
  ppV08_Impuestos: number;
  ppV08_PorImpuesto: number;
  ppV08_Precio: number;
  ppV08_PrecioCosto: number;
  ppV08_Almacen: string | null;
  ppV08_Incluido: string;
  ppV08_Exonerado: string;
  ppV08_Moneda: string;
  ppV08_TCambio: number;
  ppV08_NCuenta: string;
  ppV08_Tiempo: number;
  ppV08_Estado: string;
  ppV08_Comentario: string | null;
  ppV08_Orden: number;
  ppV08_Operador: string;
  ppV08_Comandar: string;
  ppV08_PrecioSinImpNeto: number;
}

export interface NotaPedidoRestauranteTotales {
  subtotal: number;
  subtotalneto: number;
  impuestos: number;
  total: number;
  granTotal: number;
}

export interface NotaPedidoRestauranteProceso91Response {
  detalles: NotaPedidoRestauranteDetalle[];
  totales: NotaPedidoRestauranteTotales;
  maxOrden: number;
  totalPropina: number;
  respuesta: string;
}

export interface NotaPedidoRestauranteProceso91Params {
  tipNp: string;
  serieNp: string;
  numNp: string;
  pntVta: string;
  fecha: string;
  exonerado: number | string;
}

export interface NotaPedidoRestauranteEliminarItemParams {
  tipNp: string;
  serieNp: string;
  numNp: string;
  nItem: number;
  fecha: string;
}

export interface NotaPedidoRestauranteCambiarCuentaParams {
  tipNp: string;
  serieNp: string;
  numNp: string;
  nItem: number;
  subtotal: number;
  fecha: string;
}

export interface DivideProductoRequest {
  proceso: number;
  tipNp: string;
  serieNp: string;
  numNp: string;
  codProducto: string;
  nomProducto: string;
  grupo: string;
  categoria: string;
  uMedida: string;
  cantidad: number;
  unidConImp: number;
  precio: number;
  incluido: number;
  moneda: string;
  nCuenta: number;
  tiempo: number;
  estado: number;
  operador: string;
  ordenOrigen: number;
  partes: number;
  respuesta: string;
}

export interface DivideProductoParams {
  tipNp: string;
  serieNp: string;
  numNp: string;
  ordenOrigen: number;
  partes: number;
}

export interface RegistrarPropinaParams {
  tipNp: string;
  serieNp: string;
  numNp: string;
  precio: number;
  moneda: string;
  nCuenta: number;
}

export interface VerificarFinalizarNotaPedidoRequest {
  tipNp: string;
  serieNp: string;
  numNp: string;
  numMesa: string;
  pntVta: string;
  codArea: string;
}

export interface RestaurantRoomChargePayload {
  proceso: number;
  tipCrgHab: string;
  numCrgHab: string;
  codRsv: string;
  numHab: string;
  pntVenta: string;
  fecha: string;
  hora: string;
  numDocu: string;
  nombrePax: string;
  mtoTotal: number;
  moneda: string;
  cierre: number;
  numCierre: number;
  tipNP: string;
  serieNP: string;
  numNP: string;
  numCuenta: number;
  operador: string;
}

export interface RestaurantCreditRoom {
  numHabita: string;
  codReserva: string;
  codAgen: string;
  codTarifa: string;
  codPlan: string;
  catHabi: string;
  tipHabi: string;
  fechaIng: string;
  fechaSal: string;
  noches: number;
  numPax: number;
  numChild: number;
  credito: number;
  limiteCre: number;
  monedaLmt: string;
  tarjeta: string;
  vence: string;
  autoriza: string;
  tarxNoc: number;
  monedaTar: string;
  folio: string;
  numFolio: string;
  comentarios: string;
  operador: string;
  nomPax: string;
}

interface RestaurantCreditRoomsResponse {
  success: boolean;
  message: string;
  data: RestaurantCreditRoom[];
  totalRegistros: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotaPedidoRestauranteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  ejecutar(payload: NotaPedidoRestauranteRequest): Observable<NotaPedidoRestauranteEjecutarResponse> {
    return this.http.post<NotaPedidoRestauranteEjecutarResponse>(`${this.baseUrl}/nota-pedido-restaurante/ejecutar`, {
      ...payload,
      fecha: this.normalizeProceso91Fecha(payload.fecha)
    });
  }

  eliminarItem(params: NotaPedidoRestauranteEliminarItemParams): Observable<NotaPedidoRestauranteEjecutarResponse> {
    return this.http.post<NotaPedidoRestauranteEjecutarResponse>(
      `${this.baseUrl}/nota-pedido-restaurante/eliminar-item`,
      this.buildEliminarItemPayload(params)
    );
  }

  cambiarCuenta(params: NotaPedidoRestauranteCambiarCuentaParams): Observable<NotaPedidoRestauranteEjecutarResponse> {
    return this.http.post<NotaPedidoRestauranteEjecutarResponse>(
      `${this.baseUrl}/nota-pedido-restaurante/cambiar-cuenta`,
      this.buildCambiarCuentaPayload(params)
    );
  }

  dividirProducto(params: DivideProductoParams): Observable<NotaPedidoRestauranteEjecutarResponse> {
    return this.http.post<NotaPedidoRestauranteEjecutarResponse>(
      `${this.baseUrl}/divide-producto/producto`,
      this.buildDividirProductoPayload(params)
    );
  }

  registrarPropina(params: RegistrarPropinaParams): Observable<NotaPedidoRestauranteEjecutarResponse> {
    return this.http.post<NotaPedidoRestauranteEjecutarResponse>(
      `${this.baseUrl}/divide-producto/propina`,
      this.buildPropinaPayload(params)
    );
  }

  registrarCargoHabitacion(payload: RestaurantRoomChargePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/cargo-habitacion-restaurante`, payload);
  }

  obtenerHabitacionesConCredito(): Observable<RestaurantCreditRoom[]> {
    return this.http
      .get<RestaurantCreditRoomsResponse>(`${this.baseUrl}/cargo-habitacion/habitaciones-con-credito`)
      .pipe(map((response) => Array.isArray(response?.data) ? response.data : []));
  }

  obtenerDetallePedido(
    params: NotaPedidoRestauranteProceso91Params
  ): Observable<NotaPedidoRestauranteProceso91Response> {
    const httpParams = new HttpParams()
      .set('tipNp', params.tipNp)
      .set('serieNp', params.serieNp)
      .set('numNp', params.numNp)
      .set('pntVta', params.pntVta)
      .set('fecha', this.normalizeProceso91Fecha(params.fecha))
      .set('exonerado', String(params.exonerado));

    return this.http.get<NotaPedidoRestauranteProceso91Response>(
      `${this.baseUrl}/nota-pedido-restaurante/proceso-91`,
      { params: httpParams }
    );
  }

  verificarFinalizarNotaPedido(payload: VerificarFinalizarNotaPedidoRequest): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/nota-pedido-restaurante/verificar-finalizar`, payload);
  }

  private buildEliminarItemPayload(params: NotaPedidoRestauranteEliminarItemParams): NotaPedidoRestauranteRequest {
    return {
      proceso: 0,
      tipNp: params.tipNp,
      serieNp: params.serieNp,
      numNp: params.numNp,
      pntVta: '',
      codArea: '',
      numMesa: '',
      fecha: this.normalizeProceso91Fecha(params.fecha),
      hora: '',
      codMozo: '',
      cCliente: '',
      rucCliente: '',
      nomCliente: '',
      exonerado: 0,
      subtotal: 0,
      impuesto: 0,
      totalDoc: 0,
      estado: '',
      moneda: '',
      tCambio: 0,
      lPrecio: '',
      nItem: Number(params.nItem || 0),
      nRoom: '',
      comentario: '',
      operador: '',
      detalle: [],
      respuesta: ''
    };
  }

  private buildCambiarCuentaPayload(params: NotaPedidoRestauranteCambiarCuentaParams): NotaPedidoRestauranteRequest {
    return {
      proceso: 0,
      tipNp: params.tipNp,
      serieNp: params.serieNp,
      numNp: params.numNp,
      pntVta: '',
      codArea: '',
      numMesa: '',
      fecha: this.normalizeProceso91Fecha(params.fecha),
      hora: '',
      codMozo: '',
      cCliente: '',
      rucCliente: '',
      nomCliente: '',
      exonerado: 0,
      subtotal: Number(params.subtotal || 0),
      impuesto: 0,
      totalDoc: 0,
      estado: '',
      moneda: '',
      tCambio: 0,
      lPrecio: '',
      nItem: Number(params.nItem || 0),
      nRoom: '',
      comentario: '',
      operador: '',
      detalle: [],
      respuesta: ''
    };
  }

  private buildDividirProductoPayload(params: DivideProductoParams): DivideProductoRequest {
    return {
      proceso: 0,
      tipNp: params.tipNp,
      serieNp: params.serieNp,
      numNp: params.numNp,
      codProducto: '',
      nomProducto: '',
      grupo: '',
      categoria: '',
      uMedida: '',
      cantidad: 0,
      unidConImp: 0,
      precio: 0,
      incluido: 0,
      moneda: '',
      nCuenta: 0,
      tiempo: 0,
      estado: 0,
      operador: '',
      ordenOrigen: Number(params.ordenOrigen || 0),
      partes: Number(params.partes || 0),
      respuesta: ''
    };
  }

  private buildPropinaPayload(params: RegistrarPropinaParams): DivideProductoRequest {
    return {
      proceso: 2,
      tipNp: params.tipNp,
      serieNp: params.serieNp,
      numNp: params.numNp,
      codProducto: '',
      nomProducto: '',
      grupo: '',
      categoria: '',
      uMedida: '',
      cantidad: 0,
      unidConImp: 0,
      precio: Number(params.precio || 0),
      incluido: 0,
      moneda: params.moneda,
      nCuenta: Number(params.nCuenta || 0),
      tiempo: 0,
      estado: 0,
      operador: '',
      ordenOrigen: 0,
      partes: 0,
      respuesta: ''
    };
  }

  private normalizeProceso91Fecha(value: string): string {
    const normalized = (value || '').trim();
    const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashDate) {
      return `${slashDate[1].padStart(2, '0')}/${slashDate[2].padStart(2, '0')}/${slashDate[3]}`;
    }

    const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDate) {
      return `${isoDate[3].padStart(2, '0')}/${isoDate[2].padStart(2, '0')}/${isoDate[1]}`;
    }

    return normalized;
  }
}
