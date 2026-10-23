export interface ComprasIvaQuery {
  fechaInicio: string;
  fechaFin: string;
  proveedor?: string;
}

export interface CompraIvaDetalle {
  fechaFactura: string;
  numDocu: string;
  numFactura: string;
  claveFactura: string;
  cedulaProveedor: string;
  proveedor: string;
  orden: string;
  codProducto: string;
  producto: string;
  cabys: string;
  tipoCompra: string;
  porcentajeIVA: number;
  monedaOriginal: string;
  tipoCambio: number;
  baseCRC: number;
  impuestoCRC: number;
  exoneracionCRC: number;
  totalCRC: number;
}

export interface CompraIvaFactura {
  fechaFactura: string;
  numDocu: string;
  numFactura: string;
  claveFactura: string;
  cedulaProveedor: string;
  proveedor: string;
  tipoCompra: string;
  base0: number;
  base1: number;
  base2: number;
  base4: number;
  base13: number;
  ivA1: number;
  ivA2: number;
  ivA4: number;
  ivA13: number;
  totalBase: number;
  totalIVA: number;
  totalExoneracion: number;
  totalCompra: number;
}

export interface CompraIvaConsolidado {
  tipoCompra: string;
  base0: number;
  base1: number;
  base2: number;
  base4: number;
  base13: number;
  ivA1: number;
  ivA2: number;
  ivA4: number;
  ivA13: number;
  totalBase: number;
  totalIVA: number;
  totalExoneracion: number;
  totalCompra: number;
}
