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
  porDescu: number;
  mtoDescu: number;
  totalNeto: number;
  porImpu: number;
  mtoImpu: number;
  mtoTotal: number;
}

export interface OrdenPedidoPagoItem {
  frmPago: string;
  referencia: string;
  moneda: string;
  monto: number;
  tCambio: number;
}

export interface OrdenPedidoExoneracion {
  tipoDocumentoEX1: string;
  numeroDocumento: string;
  nombreInstitucion: string;
  tarifaExonerada: number;
  montoExoneracion: number;
}

export interface OrdenPedidoCreatePayload {
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
  observaciones: string;
  detalle: OrdenPedidoDetalleItem[];
  formasPago: OrdenPedidoPagoItem[];
  subTotal: number;
  impuesto: number;
  totDocu: number;
  totalPago: number;
  exoneracion?: OrdenPedidoExoneracion | null;
}

export interface OrdenPedidoCreateResponse {
  respuesta?: string;
  mensaje?: string;
  datos?: unknown;
}
