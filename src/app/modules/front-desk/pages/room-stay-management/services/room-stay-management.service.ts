import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';

export interface RoomStayApiGuest {
  numInterno        : string;
  codReserva        : string;
  numHabita         : string;
  nacionalidad      : string;
  tipDocu           : string;
  numDocu           : string;
  nombre            : string;
  apellidos         : string;
  fecNaci           : string;
  sexo              : string;
  estCivil          : string;
  tipoPax           : string;
  direccion         : string;
  email             : string;
  motivo            : string;
  procede           : string;
  mdoArribo         : string;
  orden             : number;
  operador          : string;
}

export interface RoomStayApiCharge {
  tipCrgHab?         : string;
  tipoCrgHab?        : string;
  tipCargo?          : string;
  pntVenta            : string;
  numCrgHab           : string;
  codReserva          : string;
  numHab              : string;
  fecCargo            : string;
  horaCargo           : string;
  folio               : string;
  nombreHuesped       : string;
  totCargo            : number;
  moneda              : string;
  estado              : number;
  operador            : string;
}

export interface RoomStayApiData {
  codReserva              : string;
  numHabita               : string;
  codAgencia              : string;
  codTarifa               : string;
  codPlan                 : string;
  fechaIng                : string;
  fechaSal                : string;
  noches                  : number;
  numPax                  : number;
  numChild                : number;
  totDias                 : number;
  catHabi                 : string;
  tipHabi                 : string;
  credito                 : number;
  limiteCre               : number;
  monedaLmt               : string;
  tarjeta                 : string;
  vence                   : string;
  autoriza                : string;
  tarxNoc                 : number;
  folio                   : string;
  totalRsv                : number;
  observacion             : string;
  comentarios             : string;
  nombreAgencia           : string;
  roomingList             : RoomStayApiGuest[];
  cargosFolioMaster       : RoomStayApiCharge[];
  cargosExtras            : RoomStayApiCharge[];
}

export interface RoomAvailabilityApiRoom {
  numHab                : number;
  cateHab               : string;
  tipoHab               : string;
  codGrp                : string;
  totCamas              : number;
  numPax                : number;
  descripcion           : string;
  estHab                : string;
  clean                 : string;
  anexo                 : string;
  activo                : string;
  cantidadDisponible    : number;
}

export interface RoomChangePayload {
  codReserva    : string;
  oldHab        : string;
  newHab        : string;
  folio         : string;
  operador      : string;
}

export interface DepartureDateChangePayload {
  codReserva      : string;
  habitacion      : string;
  fechaSalida     : string;
  operador        : string;
}

export interface RoomCheckoutPayload {
  proceso         : number;
  fecCheckout     : string;
  codReserva      : string;
  numHabitacion   : string;
  folio           : string;
  operador        : string;
}

export interface RoomCheckoutResponse {
  mensaje         : string;
  codReserva      : string;
  numHabitacion   : string;
  fecCheckout     : string;
}

export interface PointOfSalePaymentMethodApi {
  CA05_Codigo         : string;
  CA05_Descripcion    : string;
  CA05_Tipo           : string;
  CA05_TipPago        : string;
  CA05_NDias          : number;
}

export interface PointOfSaleDocumentApi {
  MPV31_CodPntVenta    : string;
  MPV31_CodDocu        : string;
  MPV31_Descripcion    : string;
  MPV31_Principal      : number;
  MPV31_Operador       : string;
}

export interface RoomChargePointOfSaleApi {
  MPV07_CodPntVenta      : string;
  MPV07_NomPntVenta      : string;
  MPV07_CodComanda       : string;
  MPV07_CodDocumento     ?: string;
  MPV07_CodLstPrecio     ?: string;
  MPV10_CodPntVenta      ?: string;
  MPV10_Principal        ?: number;
  MPV10_CodLstPrecio     : string;
  MPV04_CodLstPrecio     ?: string;
  MPV04_DesLstPrecio     ?: string;
  MPV04_Moneda           : string;
  MPV04_Vigente          ?: string;
  MPV07_ImpresoraA       : unknown;
  MPV07_ImpresoraB       : unknown;
}

export interface RoomChargePriceListApiItem {
  MPV05_ID              ?: number;
  MPV05_CodLstPrecio     : string;
  MPV01_CodGrupo         : string;
  MPV00_NomCategoria     : string;
  MPV05_CodProducto      : string;
  MPV05_DesProducto      : string;
  MPV05_NomCorto         : string;
  MPV01_UMedida          : string;
  MPV05_PrecioTotal      : number;
  MPV05_CostoProdu       : number;
  MPV05_Impuesto         : number;
  MPV05_Moneda           : string;
  MPV05_Orden            : number;
  MPV01_CodCategoria     : string;
  MPV05_Operador         : string;
}

export interface RoomChargeDetailPayload {
  codRsv            : string;
  numHab            : string;
  pntVenta          : string;
  fecha             : string;
  hora              : string;
  grupo             : string;
  categoria         : string;
  codConsumo        : string;
  nomConsumo        : string;
  cantidad          : number;
  precio            : number;
  total             : number;
  moneda            : string;
  tipNPedido        : string;
  numNPedido        : string;
  codMozo           : string;
  incluido          : number;
  exonerado         : number;
  orden             : number;
  comentario        : string;
  operador          : string;
}

export interface RoomChargePayload {
  proceso         : number;
  tipCrgHab       : string;
  numCrgHab       : string;
  codRsv          : string;
  numHab          : string;
  pntVenta        : string;
  fecha           : string;
  hora            : string;
  numDocu         : string;
  nombrePax       : string;
  mtoTotal        : number;
  moneda          : string;
  cierre          : number;
  numCierre       : number;
  operador        : string;
  detalle         : RoomChargeDetailPayload[];
}

export interface RoomChargeAnnulPayload {
  tipCrgHab     : string;
  numCrgHab     : string;
  codRsv        : string;
  numHab        : string;
  motivo        : string;
  operador      : string;
}

export interface RoomChargeLookupHeader {
  tipCrgHab     : string;
  numCrgHab     : string;
  codReserva    : string;
  numHab        : string;
  pntVenta      : string;
  fecha         : string;
  hora          : string;
  numDocu       : string;
  nombrePax     : string;
  mtoTot        : number;
  moneda        : string;
  cierre        : string;
  numCierre     : string;
  estado        : string;
  operador      : string;
}

export interface RoomChargeLookupDetail {
  tipCrgHab     : string;
  numCrgHab     : string;
  codRsv        : string;
  numHab        : string;
  pntVenta      : string;
  fecha         : string;
  hora          : string;
  grupo         : string;
  categoria     : string;
  codConsumo    : string;
  nomConsumo    : string;
  cantidad      : number;
  precio        : number;
  total         : number;
  moneda        : string;
  tipNPedido    : string;
  numNPedido    : string;
  codMozo       : string;
  incluido      : string;
  exonerado     : string;
  orden         : number;
  estado        : string;
  comentario    : string;
  porDescuento  : number;
  descuento     : number;
  precioLista   : number;
  operador      : string;
}

export interface RoomChargeLookupResponse {
  encabezado    : RoomChargeLookupHeader;
  detalles      : RoomChargeLookupDetail[];
}

export interface RoomingListUpdatePayload {
  proceso         : number;
  idOpe           : string;
  codRsv          : string;
  numHabita       : string;
  codNacion       : string;
  tipDocu         : string;
  numDocu         : string;
  nombre          : string;
  apellido        : string;
  fecNac          : string;
  sexo            : string;
  estCivil        : string;
  tiPax           : string;
  direccion       : string;
  email           : string;
  motivo          : string;
  procede         : string;
  mdoArribo       : string;
  orden           : number;
  operador        : string;
}

export interface RoomInvoiceDocumentDetailPayload {
  orden           : number;
  fecha           : string;
  grupo           : string;
  codConsumo      : string;
  nomConsumo      : string;
  cantidad        : number;
  precio          : number;
  subTotal        : number;
  porDescuento    : number;
  descuento       : number;
  neto            : number;
  impuest         : number;
  total           : number;
  tipNPedido      : string;
  numNPedido      : string;
  codMozo         : string;
  pntVenta        : string;
  almacen         : string;
  incluido        : string;
  moneda          : string;
  operador        : string;
}

export interface RoomInvoicePaymentPayload {
  orden           : number;
  frmPago         : string;
  tipo            : string;
  numTarjeta      : string;
  moneda          : string;
  monto           : number;
  vencimiento     : string;
  mtoTotal        : number;
  tCambio         : number;
}

export interface RoomInvoicePayload {
  proceso         : number;
  tipDocu         : string;
  serieDocu       : string;
  numDocu         : string;
  codCliente      : string;
  rucClie         : string;
  nomClie         : string;
  direccion       : string;
  numInterno      : string;
  codReserva      : string;
  habita          : string;
  master          : string;
  fechaDocu       : string;
  fechaPago       : string;
  fechaVen        : string;
  subTotal        : number;
  descuento       : number;
  neto            : number;
  impuesto        : number;
  exonera         : number;
  totDocumento    : number;
  totPago         : number;
  totPropina      : number;
  pntVenta        : string;
  codVendedor     : string;
  moneda          : string;
  tCambio         : number;
  estado          : string;
  formaPago       : string;
  numCuenta       : number;
  tipo            : string;
  tipNdp          : string;
  numeroNdp       : string;
  operador        : string;
  detDocumento    : RoomInvoiceDocumentDetailPayload[];
  frmPago         : RoomInvoicePaymentPayload[];
}

interface RoomStayApiResponse {
  success     ?: boolean;
  data        ?: RoomStayApiData | null;
  message     ?: string;
}

interface RoomAvailabilityApiResponse {
  success     ?: boolean;
  data        ?: RoomAvailabilityApiRoom[] | null;
  message     ?: string;
}

interface RoomChargePriceListApiResponse {
  datos?: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class RoomStayManagementService {
  private readonly http                            = inject(HttpClient);
  private readonly baseApiUrl                      = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
  private readonly apiUrl                          = `${this.baseApiUrl}/walkin`;
  private readonly precheckingUrl                  = `${this.baseApiUrl}/prechecking`;
  private readonly roomChangeUrl                   = `${this.baseApiUrl}/roomchange`;
  private readonly departureDateChangeUrl          = `${this.baseApiUrl}/cambio-fecha-salida`;
  private readonly roomCheckoutUrl                  = `${this.baseApiUrl}/checkout/habitacion`;
  private readonly pointOfSalePaymentMethodsUrl    = `${this.baseApiUrl}/forma-pago-punto-venta`;
  private readonly pointOfSaleDocumentsUrl         = `${this.baseApiUrl}/documento-puntoventa`;
  private readonly roomChargeUrl                   = `${this.baseApiUrl}/cargo-habitacion`;
  private readonly roomChargeLookupUrl             = `${this.baseApiUrl}/consultar-cargos-habitacion/numero`;
  private readonly roomInvoiceUrl                  = `${this.baseApiUrl}/facturacion-fdesk`;
  private readonly roomingListUpdateUrl            = `${this.baseApiUrl}/rooming-list/con-actualizacion`;
  private readonly pointOfSaleDetailUrl            = `${this.baseApiUrl}/puntoventa/detalleprincipal`;
  private readonly priceListDetailUrl              = `${this.baseApiUrl}/detalle-lista-precio`;

  getRoomStay(roomNumber: string, codReserva?: string): Observable<RoomStayApiData | null> {
    return this.http
      .get<RoomStayApiResponse | RoomStayApiData>(`${this.apiUrl}/habitacion/${encodeURIComponent(this.cleanParam(roomNumber))}`)
      .pipe(
        map((response) => this.normalizeResponse(response)),
        switchMap((baseStay) => this.getRoomStayDetail(baseStay, codReserva))
      );
  }

  getAvailableRooms(fechaIng: string, fechaSal: string, categoria: string): Observable<RoomAvailabilityApiRoom[]> {
    const params = new HttpParams()
      .set('fechaIng', normalizePmsDateDDMMYYYY(fechaIng))
      .set('fechaSal', normalizePmsDateDDMMYYYY(fechaSal))
      .set('categoria', this.cleanParam(categoria));

    return this.http
      .get<RoomAvailabilityApiResponse | RoomAvailabilityApiRoom[]>(`${this.precheckingUrl}/disponibilidad`, { params })
      .pipe(map((response) => this.normalizeAvailabilityResponse(response)));
  }

  changeRoom(payload: RoomChangePayload): Observable<unknown> {
    return this.http.put<unknown>(this.roomChangeUrl, payload);
  }

  changeDepartureDate(payload: DepartureDateChangePayload): Observable<unknown> {
    return this.http.put<unknown>(this.departureDateChangeUrl, {
      ...payload,
      fechaSalida: normalizePmsDateDDMMYYYY(payload.fechaSalida)
    });
  }

  checkoutRoom(payload: RoomCheckoutPayload): Observable<RoomCheckoutResponse> {
    return this.http
      .post<RoomCheckoutResponse>(this.roomCheckoutUrl, {
        ...payload,
        fecCheckout: normalizePmsDateDDMMYYYY(payload.fecCheckout)
      })
      .pipe(map((response) => ({ ...response, fecCheckout: normalizePmsDateDDMMYYYY(response.fecCheckout) })));
  }

  getPointOfSalePaymentMethods(puntoVenta = 'PF'): Observable<PointOfSalePaymentMethodApi[]> {
    const params = new HttpParams().set('puntoVenta', this.cleanParam(puntoVenta));

    return this.http
      .get<PointOfSalePaymentMethodApi[] | { success?: boolean; data?: PointOfSalePaymentMethodApi[] | null }>(
        this.pointOfSalePaymentMethodsUrl,
        { params }
      )
      .pipe(map((response) => (Array.isArray(response) ? response : response.data ?? [])));
  }

  getPointOfSaleDocuments(puntoVenta = 'PF'): Observable<PointOfSaleDocumentApi[]> {
    const codigo = encodeURIComponent(this.cleanParam(puntoVenta) || 'PF');
    return this.http.get<PointOfSaleDocumentApi[]>(`${this.pointOfSaleDocumentsUrl}/${codigo}`).pipe(
      map((response) => (Array.isArray(response) ? response : []))
    );
  }

  getRoomChargePointOfSales(pointOfSale = 'PF'): Observable<RoomChargePointOfSaleApi[]> {
    const codigo = encodeURIComponent(this.cleanParam(pointOfSale) || 'PF');

    return this.http.get<RoomChargePointOfSaleApi[]>(`${this.pointOfSaleDetailUrl}/${codigo}`).pipe(
      map((response) => (Array.isArray(response) ? response : []))
    );
  }

  getRoomChargePriceListItems(codListaPrecio: string): Observable<RoomChargePriceListApiItem[]> {
    const codigo = encodeURIComponent(this.cleanParam(codListaPrecio));

    if (!codigo) {
      return of([]);
    }

    return this.http
      .get<Array<Record<string, unknown>> | RoomChargePriceListApiResponse>(`${this.priceListDetailUrl}/punto-venta/${codigo}`)
      .pipe(map((response) => this.extractPriceListData(response).map((item) => this.mapPriceListItem(item))));
  }

  createRoomCharge(payload: RoomChargePayload): Observable<unknown> {
    const normalizedPayload = this.normalizeRoomChargePayload(payload);

    return this.http
      .post(this.roomChargeUrl, normalizedPayload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  updateRoomCharge(payload: RoomChargePayload): Observable<unknown> {
    const normalizedPayload = this.normalizeRoomChargePayload(payload);

    return this.http
      .put(this.roomChargeUrl, normalizedPayload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  annulRoomCharge(payload: RoomChargeAnnulPayload): Observable<unknown> {
    return this.http
      .delete(this.roomChargeUrl, { body: payload, responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  getRoomChargeDetailByNumber(numCrgHab: string): Observable<RoomChargeLookupResponse> {
    const numero = encodeURIComponent(this.cleanParam(numCrgHab));

    return this.http
      .get<RoomChargeLookupResponse>(`${this.roomChargeLookupUrl}/${numero}`)
      .pipe(
        map((response) => ({
          encabezado: {
            ...response.encabezado,
            fecha: normalizePmsDateDDMMYYYY(response.encabezado?.fecha)
          },
          detalles: Array.isArray(response.detalles)
            ? response.detalles.map((item) => ({ ...item, fecha: normalizePmsDateDDMMYYYY(item.fecha) }))
            : []
        }))
      );
  }

  private normalizeRoomChargePayload(payload: RoomChargePayload): RoomChargePayload {
    return {
      ...payload,
      fecha: normalizePmsDateDDMMYYYY(payload.fecha),
      detalle: payload.detalle.map((item) => ({
        ...item,
        fecha: normalizePmsDateDDMMYYYY(item.fecha)
      }))
    };
  }

  createRoomingListGuest(payload: RoomingListUpdatePayload): Observable<unknown> {
    const normalizedPayload = {
      ...payload,
      fecNac: normalizePmsDateDDMMYYYY(payload.fecNac)
    };

    return this.http
      .post(this.roomingListUpdateUrl, normalizedPayload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  invoiceRoom(payload: RoomInvoicePayload): Observable<unknown> {
    return this.http.post<unknown>(this.roomInvoiceUrl, {
      ...payload,
      fechaDocu: normalizePmsDateDDMMYYYY(payload.fechaDocu),
      fechaPago: normalizePmsDateDDMMYYYY(payload.fechaPago),
      fechaVen: normalizePmsDateDDMMYYYY(payload.fechaVen),
      detDocumento: payload.detDocumento.map((item) => ({
        ...item,
        fecha: normalizePmsDateDDMMYYYY(item.fecha)
      }))
    });
  }

  private getRoomStayDetail(baseStay: RoomStayApiData | null, fallbackCodReserva?: string): Observable<RoomStayApiData | null> {
    if (!baseStay) {
      return of(null);
    }

    const codReserva = this.cleanParam(baseStay.codReserva || fallbackCodReserva);
    const numHabitacion = this.cleanParam(baseStay.numHabita);
    const folio = this.cleanParam(baseStay.folio);

    if (!codReserva || !numHabitacion || !folio) {
      return of(baseStay);
    }

    const params = new HttpParams()
      .set('codReserva', codReserva)
      .set('numHabitacion', numHabitacion)
      .set('folio', folio);

    return this.http
      .get<RoomStayApiResponse | RoomStayApiData>(`${this.apiUrl}/consultar`, { params })
      .pipe(map((response) => this.normalizeResponse(response) ?? baseStay));
  }

  private normalizeResponse(response: RoomStayApiResponse | RoomStayApiData | null): RoomStayApiData | null {
    if (!response) {
      return null;
    }

    if (this.isApiEnvelope(response)) {
      return response.data ? this.normalizeStayDates(response.data) : null;
    }

    return this.normalizeStayDates(response);
  }

  private normalizeStayDates(stay: RoomStayApiData): RoomStayApiData {
    return {
      ...stay,
      fechaIng: normalizePmsDateDDMMYYYY(stay.fechaIng),
      fechaSal: normalizePmsDateDDMMYYYY(stay.fechaSal),
      roomingList: Array.isArray(stay.roomingList)
        ? stay.roomingList.map((guest) => ({ ...guest, fecNaci: normalizePmsDateDDMMYYYY(guest.fecNaci) }))
        : [],
      cargosFolioMaster: Array.isArray(stay.cargosFolioMaster)
        ? stay.cargosFolioMaster.map((charge) => ({ ...charge, fecCargo: normalizePmsDateDDMMYYYY(charge.fecCargo) }))
        : [],
      cargosExtras: Array.isArray(stay.cargosExtras)
        ? stay.cargosExtras.map((charge) => ({ ...charge, fecCargo: normalizePmsDateDDMMYYYY(charge.fecCargo) }))
        : []
    };
  }

  private isApiEnvelope(response: RoomStayApiResponse | RoomStayApiData): response is RoomStayApiResponse {
    return Object.prototype.hasOwnProperty.call(response, 'success') || Object.prototype.hasOwnProperty.call(response, 'data');
  }

  private normalizeAvailabilityResponse(response: RoomAvailabilityApiResponse | RoomAvailabilityApiRoom[] | null): RoomAvailabilityApiRoom[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  private extractPriceListData(
    response: Array<Record<string, unknown>> | RoomChargePriceListApiResponse | null | undefined
  ): Array<Record<string, unknown>> {
    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response?.datos) ? response.datos : [];
  }

  private mapPriceListItem(api: Record<string, unknown>): RoomChargePriceListApiItem {
    return {
      MPV05_ID                : this.toOptionalNumber(api['MPV05_ID'] ?? api['MPV05_Id'] ?? api['id']),
      MPV05_CodLstPrecio      : this.toText(api['MPV05_CodLstPrecio']),
      MPV01_CodGrupo          : this.toText(api['MPV01_CodGrupo']),
      MPV00_NomCategoria      : this.toText(api['MPV00_NomCategoria']),
      MPV05_CodProducto       : this.toText(api['MPV05_CodProducto']),
      MPV05_DesProducto       : this.toText(api['MPV05_DesProducto']),
      MPV05_NomCorto          : this.toText(api['MPV05_NomCorto']),
      MPV01_UMedida           : this.toText(api['MPV01_UMedida']),
      MPV05_PrecioTotal       : this.toNumber(api['MPV05_PrecioTotal']),
      MPV05_CostoProdu        : this.toNumber(api['MPV05_CostoProdu']),
      MPV05_Impuesto          : this.toNumber(api['MPV05_Impuesto']),
      MPV05_Moneda            : this.toText(api['MPV05_Moneda']),
      MPV05_Orden             : this.toNumber(api['MPV05_Orden']),
      MPV01_CodCategoria      : this.toText(api['MPV01_CodCategoria']),
      MPV05_Operador          : this.toText(api['MPV05_Operador'])
    };
  }

  private parseTextResponse(response: string): unknown {
    const trimmed = (response || '').trim();

    if (!trimmed) {
      return {};
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return { respuesta: trimmed };
    }
  }

  private cleanParam(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private toText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    return '';
  }

  private toNumber(value: unknown): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const numberValue = this.toNumber(value);
    return numberValue > 0 ? numberValue : undefined;
  }
}
