export interface OrdenPedidoFiltro {
  tipOrden      : string;
  fechaDesde    : string;
  fechaHasta    : string;
  nomCliente    : string;
  pageNumber    : number;
  pageSize      : number;
}

export interface OrdenPedidoPaginacion {
  totalRegistros    : number;
  paginaActual      : number;
  pageSize          : number;
  totalPaginas      : number;
}

export interface OrdenPedidoListadoItem {
  tipOrden          : string;
  serie             : string;
  numero            : string;
  fecha             : string;
  cliente           : string;
  ruc               : string;
  items             : number;
  subtotal          : number;
  impuesto          : number;
  total             : number;
  estado            : string;
  observaciones     : string;
  operador          : string;
}

export interface OrdenPedidoListadoResponse {
  datos       : OrdenPedidoListadoItem[];
  paginacion  : OrdenPedidoPaginacion;
}

export interface OrdenPedidoCompletaEncabezado {
  tipNDP                : string;
  serieNDP              : string;
  numNDP                : string;
  puntoVenta            : string;
  fechaDocumento        : string;
  horaDocumento         : string;
  codVendedor           : string;
  codCliente            : string;
  rucCliente            : string;
  nomCliente            : string;
  dirCliente            : string;
  subtotal              : number;
  impuesto              : number;
  totalDocumento        : number;
  totalPago             : number;
  estadoDocumento       : string;
  moneda                : string;
  tipoCambio            : number;
  fechaVencimiento      : string;
  listaPrecio           : string;
  items                 : number;
  referencia            : string;
  observaciones         : string;
  operador              : string;
  idBee                 : string;
  codActividad          : string;
}

export interface OrdenPedidoCompletaDetalleItem {
  orden                 : number;
  codProducto           : string;
  nomProducto           : string;
  categoria             : string;
  cantidad              : number;
  unidadMedida          : string;
  precioUnitarioLista   : number;
  unitarioSinImpuesto   : number;
  subtotalSinImpuesto   : number;
  porcentajeDescuento   : number;
  descuento             : number;
  totalNeto             : number;
  porcentajeImpuesto    : number;
  impuesto              : number;
  unitarioConImpuesto   : number;
  totalLinea            : number;
  moneda                : string;
  tipoCambio            : number;
  almacen               : string;
}

export interface OrdenPedidoCompletaFormaPago {
  orden           : number;
  formaPago       : string;
  tipo            : string;
  moneda          : string;
  monto           : number;
  montoOriginal   : number;
  tipoCambio      : number;
  referencia      : string;
  numeroTarjeta   : string;
  vencimiento     : string;
}

export interface CambioFormaPagoPedidoPayload {
  tipoDocu: string;
  serie: string;
  numDocu: string;
  pagos: CambioFormaPagoPedidoPago[];
  operador: string;
  motivo: string;
}

export interface CambioFormaPagoPedidoPago {
  orden: number;
  frmPago: string;
  tipo: string;
  numTarjeta: string;
  referencia: string;
  moneda: string;
  monto: number;
  tCambio: number;
  vencimiento: string;
}

export interface CambioFormaPagoPedidoResponse {
  mensaje?: string;
  respuesta?: string;
  data?: unknown;
}

export interface OrdenPedidoCompletaCliente {
  codCliente    : string;
  nomCliente    : string;
  rucCliente    : string;
  contacto      : string;
  direccion     : string;
  provincia     : string;
  ciudad        : string;
  pais          : string;
  email         : string;
  telefono1     : string;
  telefono2     : string;
  tipoCliente   : string;
}

export interface OrdenPedidoCompletaResponse {
  encabezado    : OrdenPedidoCompletaEncabezado | null;
  detalle       : OrdenPedidoCompletaDetalleItem[];
  formasPago    : OrdenPedidoCompletaFormaPago[];
  cliente       : OrdenPedidoCompletaCliente | null;
}

export interface OrdenPedidoDetalleItem {
  codProdu        : string;
  producto        : string;
  area            : string;
  uMedida         : string;
  canProdu        : number;
  pUndLst         : number;
  uniSinImp       : number;
  totSinImp       : number;
  porDescu        : number;
  mtoDescu        : number;
  totalNeto       : number;
  porImpu         : number;
  mtoImpu         : number;
  porExonera      : number;
  mtoExonera      : number;
  uniConImp       : number;
  mtoTotal        : number;
  grabado         : string;
  moneda          : string;
  tCambio         : number;
  orden           : number;
  uMedidaDos      : string;
  canProduDos     : number;
  lstPrecio       : string;
  planTarifa      : string;
}

export interface OrdenPedidoPagoItem {
  orden           : number;
  frmPago         : string;
  tipo            : string;
  numTarjeta      : string;
  referencia      : string;
  moneda          : string;
  monto           : number;
  montoOri        : number;
  tCambio         : number;
  vencimiento     : string;
  caja            : string;
  turno           : string;
}

export interface OrdenPedidoExoneracion {
  tipoDocumentoEX1    : string;
  numeroDocumento     : string;
  nombreInstitucion   : string;
  tarifaExonerada     : number;
  montoExoneracion    : number;
}

export interface OrdenPedidoCreatePayload {
  proceso           : number;
  detalle           : OrdenPedidoDetalleItem[];
  formasPago        : OrdenPedidoPagoItem[];
  tipNDP            : string;
  serieNDP          : string;
  numeroNDP         : string;
  pntVenta          : string;
  fecNDP            : string;
  horaNDP           : string;
  codVendedor       : string;
  codCliente        : string;
  rucCliente        : string;
  nomCliente        : string;
  exento            : number;
  subTotal          : number;
  impuesto          : number;
  totDocu           : number;
  totalPago         : number;
  estadoNDP         : string;
  moneda            : string;
  tCambio           : number;
  fecVenc           : string;
  lstPrecio         : string;
  items             : number;
  nReferencia       : string;
  observaciones     : string;
  operador          : string;
  idBeep            : string;
  cActividad        : string;
  pageNumber        : number;
  pageSize          : number;
  respuesta         : string;
  exoneracion       ?: OrdenPedidoExoneracion | null;
}

export interface OrdenPedidoCreateResponse {
  respuesta   ?: string;
  mensaje     ?: string;
  datos       ?: Array<{
    TipNDP      ?: string;
    Serie       ?: string;
    NumNDP      ?: string;
  }>;
}
