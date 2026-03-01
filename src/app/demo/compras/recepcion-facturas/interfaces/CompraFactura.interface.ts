export interface CompraFactura {
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
