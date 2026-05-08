export interface DocumentoDetalleResponse {
  encabezado?: DocumentoEncabezado;
  detalle?: DocumentoDetalleItem[];
  impuestos?: DocumentoImpuesto[];
  pagos?: DocumentoPago[];
  cobranzas?: DocumentoCobranza[];
  totales?: DocumentoTotales;
  data?: DocumentoDetalleResponse;
}

export interface DocumentoEncabezado {
  tipDocu?: string;
  serie?: string;
  numero?: string;
  numeroConsecutivo?: string;
  clave?: string;
  fechaDocu?: string;
  condicionVenta?: string;
  codCliente?: string;
  rucCliente?: string;
  nomCliente?: string;
  moneda?: string;
  tCambio?: number;
  pntVenta?: string;
  numMesa?: string;
  numPax?: number;
  codVendedor?: string;
  codigoActividad?: string;
  observacion?: string;
  codReserva?: string;
  fechaInicio?: string;
  fechaFin?: string;
  voucherRsv?: string;
  nProveedor?: string;
  habitacion?: string;
  master?: string;
  subtotal?: number;
  descuento?: number;
  impuesto?: number;
  totalDocu?: number;
  totalPago?: number;
  estadoDocu?: string;
  estadoElectronico?: string;
}

export interface DocumentoDetalleItem {
  orden?: number;
  fechaConsumo?: string;
  lstPrecio?: string;
  codProdu?: string;
  areaProdu?: string;
  descripcion?: string;
  cantidad?: number;
  uMedida?: string;
  pUndLst?: number;
  uniSinImp?: number;
  porDescu?: number;
  porImp?: number;
  porExonera?: number;
  mtoImpVarios?: number;
  almacen?: string;
  area?: string;
  tipComanda?: string;
  comanda?: string;
  pntVenta?: string;
  mozo?: string;
  numHabita?: string;
  total?: number;
  impuesto?: number;
}

export interface DocumentoPago {
  orden?: number;
  frmPago?: string;
  tipo?: string;
  moneda?: string;
  monto?: number;
  tCambio?: number;
  referencia?: string;
  numTarjeta?: string;
  vencimiento?: string;
}

export interface CambioFormaPagoPayload {
  tipoDocu: string;
  serie: string;
  numDocu: string;
  pagos: CambioFormaPagoPago[];
  operador: string;
  motivo: string;
}

export interface CambioFormaPagoPago {
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

export interface CambioFormaPagoResponse {
  mensaje?: string;
  respuesta?: string;
  data?: unknown;
}

export interface DocumentoImpuesto {
  ordenLinea?: number;
  ordenImp?: number;
  codImpu?: string;
  descripcion?: string;
  porImpu?: number;
  baseImponible?: number;
  monto?: number;
}

export interface DocumentoCobranza {
  numCobranza?: string;
  fechaCobranza?: string;
  moneda?: string;
  montoPago?: number;
  tCambio?: number;
  estado?: string;
  formaPago?: string;
  referencia?: string;
}

export interface DocumentoTotales {
  totalLineas?: number;
  totalImpuestos?: number;
}
