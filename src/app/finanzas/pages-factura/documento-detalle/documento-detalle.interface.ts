/** Contrato devuelto por GET /documentos-facturados/detalle. */
export interface DocumentoDetalleResponse {
  encabezado: DocumentoDetalleEncabezadoApi | null;
  detalle: DocumentoDetalleItemApi[];
  formasPago: DocumentoDetalleFormaPagoApi[];
  respuesta: string;
  totalRecords: number;
}

export interface DocumentoDetalleEncabezadoApi {
  ppV00_TipoDocu: string;
  ppV00_Serie: string;
  ppV00_NumDocu: string;
  ppV00_CodReserva: string;
  ppV00_Habitacion: string;
  ppV00_Master: string;
  ppV00_FechaDocu: string;
  ppV00_CodCliente: string;
  ppV00_RucCliente: string;
  ppV00_NomCliente: string;
  ppV00_PntVenta: string;
  ppV00_CodMozo: string;
  ppV00_SubTotal: number;
  ppV00_Descuento: number;
  ppV00_Neto: number;
  ppV00_Impuesto: number;
  ppV00_TotalDocu: number;
  ppV00_TotalPago: number;
  ppV00_EstDocu: string;
  ppV00_Moneda: string;
  ppV00_TCambio: number;
  ppV00_NumMesa: string;
  ppV00_NumPax: string;
  ppV15_NumeroConsecutivo: string;
  ppV15_Clave: string;
  ppV15_Vendedor: string;
  ppV15_Condicion_Venta: string;
  ppV15_Estado_Comprobante: string;
}

export interface DocumentoDetalleItemApi {
  ppV01_FecConsumo: string;
  ppV01_Area: string;
  ppV01_CodProdu: string;
  ppV01_Descripcion: string;
  ppV01_Cantidad: number;
  ppV01_UMedida: string;
  ppV01_PUndLst: number;
  ppV01_UniSinImp: number;
  ppV01_PrecioSinImp: number;
  ppV01_PorDescu: number;
  ppV01_MtoDescu: number;
  ppV01_TotalNeto: number;
  ppV01_PorImp: number;
  ppV01_Impuestos: number;
  ppV01_PorExonera: number;
  ppV01_MtoImpVarios: number;
  ppV01_Precio: number;
  ppV01_Almacen: string;
  ppV01_Orden: number;
  ppV01_TipComanda: string;
  ppV01_Comanda: string;
  ppV01_Mozo: string;
  ppV01_PntVenta: string;
  ppV01_NumHabita: string;
}

export interface DocumentoDetalleFormaPagoApi {
  ppV03_FrmPago: string;
  ppV03_Tipo: string;
  ppV03_NumTarjeta: string;
  ppV03_Moneda: string;
  ppV03_Monto: number;
  ppV03_Vencimiento: string;
  ppV03_TCambio: number;
  ppV03_Orden: number;
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
  subtotal?: number;
  descuento?: number;
  neto?: number;
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
