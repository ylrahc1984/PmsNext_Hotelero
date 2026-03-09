export interface CompraArticuloDetalleEncabezado {
  tipDocu: string;
  numDocu: string;
  tipEntra: string;
  fechaIngreso: string;
  fechaFactura: string;
  fechaVencimiento: string;
  codProveedor: string;
  rucProveedor: string;
  proveedor: string;
  tipDocProveedor: string;
  serie: string;
  numFactura: string;
  moneda: string;
  tipoCambio: number;
  totalDetalle: number;
  neto: number;
  exento: number;
  subTotal: number;
  impuesto: number;
  total: number;
  totalPagado: number;
  estado: string;
  formaPago: string;
  concepto: string;
  numOrden: string;
  operador: string;
}

export interface CompraArticuloDetalleLinea {
  tipDocu: string;
  numDocu: string;
  fecha: string;
  codProducto: string;
  producto: string;
  almacen: string;
  cantidad: number;
  undMedida: string;
  exento: number;
  mtoTotal: number;
  mtoIndi: number;
  porDesc: number;
  mtoDesc: number;
  neto: number;
  costo: number;
  costoReal: number;
  porImpto: number;
  mtoImpto: number;
  porExo: number;
  mtoExo: number;
  total: number;
  fleteInd: number;
  fleteTot: number;
  observaciones: string;
  imponible: string;
  moneda: string;
  tcambio: number;
  orden: number;
}

export interface CompraArticuloPago {
  NumInterno: number;
  IdOperacion: string;
  TipDocu: string;
  NumDocu: string;
  TipoDocPrv: string;
  SerieDocPrv: string;
  NumFacturaPrv: string;
  Fecha: string;
  Hora?: string | null;
  TipoPago: string;
  Moneda: string;
  Monto: number;
  TCambio: number;
  Estado: string;
  Descripcion: string;
  Asiento: string;
  Operador: string;
}

export interface CompraArticuloDetalleData {
  encabezado: CompraArticuloDetalleEncabezado;
  detalle: CompraArticuloDetalleLinea[];
  pagos: CompraArticuloPago[];
}

export interface CompraArticuloDetalleResponse {
  success: boolean;
  message?: string;
  data: CompraArticuloDetalleData | null;
}
