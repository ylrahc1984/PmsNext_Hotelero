export interface OrdenPedidoFiltro {
  tipOrden: string;
  fechaDesde: string;
  fechaHasta: string;
  nomCliente: string;
  pageNumber: number;
  pageSize: number;
}

export interface OrdenPedidoPaginacion {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
  totalPaginas: number;
}

export interface OrdenPedidoListadoItem {
  tipOrden: string;
  serie: string;
  numero: string;
  fecha: string;
  cliente: string;
  ruc: string;
  items: number;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: string;
  observaciones: string;
  operador: string;
}

export interface OrdenPedidoListadoResponse {
  datos: OrdenPedidoListadoItem[];
  paginacion: OrdenPedidoPaginacion;
}

export interface OrdenPedidoDetalleItem {
  codProdu: string;
  producto: string;
  area: string;
  uMedida: string;
  canProdu: number;
  pUndLst: number;
  uniSinImp: number;
  totSinImp: number;
  porDescu: number;
  mtoDescu: number;
  totalNeto: number;
  porImpu: number;
  mtoImpu: number;
  porExonera: number;
  mtoExonera: number;
  uniConImp: number;
  mtoTotal: number;
  grabado: string;
  moneda: string;
  tCambio: number;
  orden: number;
  uMedidaDos: string;
  canProduDos: number;
  lstPrecio: string;
  planTarifa: string;
}

export interface OrdenPedidoPagoItem {
  orden: number;
  frmPago: string;
  tipo: string;
  numTarjeta: string;
  referencia: string;
  moneda: string;
  monto: number;
  montoOri: number;
  tCambio: number;
  vencimiento: string;
  caja: string;
  turno: string;
}

export interface OrdenPedidoExoneracion {
  tipoDocumentoEX1: string;
  numeroDocumento: string;
  nombreInstitucion: string;
  tarifaExonerada: number;
  montoExoneracion: number;
}

export interface OrdenPedidoCreatePayload {
  proceso: number;
  detalle: OrdenPedidoDetalleItem[];
  formasPago: OrdenPedidoPagoItem[];
  tipNDP: string;
  serieNDP: string;
  numeroNDP: string;
  pntVenta: string;
  fecNDP: string;
  horaNDP: string;
  codVendedor: string;
  codCliente: string;
  rucCliente: string;
  nomCliente: string;
  exento: number;
  subTotal: number;
  impuesto: number;
  totDocu: number;
  totalPago: number;
  estadoNDP: string;
  moneda: string;
  tCambio: number;
  fecVenc: string;
  lstPrecio: string;
  items: number;
  nReferencia: string;
  observaciones: string;
  operador: string;
  idBeep: string;
  cActividad: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
  exoneracion?: OrdenPedidoExoneracion | null;
}

export interface OrdenPedidoCreateResponse {
  respuesta?: string;
  mensaje?: string;
  datos?: Array<{
    TipNDP?: string;
    Serie?: string;
    NumNDP?: string;
  }>;
}
