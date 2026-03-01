export interface RetiroCxpFactura {
  tipDocPrv: string;
  serie: string;
  numFactura: string;
  fecFactu?: string;
  fecVen?: string;
  totalDocu: number;
  saldo: number;
  moneda: string;
  estado?: string;
  tCambio?: number;
  montoPagar: number;
  codProve?: string;
  nomProve?: string;
}

export interface RetiroCxpDetalleContable {
  concepto: string;
  descripcion: string;
  moneda: string;
  monto: number;
  tCambio: number;
}

export interface RetiroCxp {
  idOperacion?: string;
  codBanco: string;
  ctaBanco: string;
  fecha: string;
  numOperacion: string;
  tipoOperacion: string;
  moneda: string;
  tipoCambio: number;
  codProve: string;
  nomProve: string;
  concepto: string;
  montoTotal: number;
  facturas: RetiroCxpFactura[];
  detalles: RetiroCxpDetalleContable[];
  movCon?: string | boolean;
}

export interface RetiroCxpListItem {
  idOperacion: string;
  codBanco: string;
  ctaBanco: string;
  fecha: string;
  numOperacion: string;
  tipoOperacion: string;
  moneda: string;
  montoTotal: number;
  codProve: string;
  nomProve: string;
  movCon?: string | boolean;
  estado?: string;
}

export interface RetiroCxpFilters {
  codBanco?: string;
  ctaBanco?: string;
  fechaInicio?: string;
  fechaFin?: string;
  pageNumber: number;
  pageSize: number;
}

export interface RetiroCxpResponse {
  datos: RetiroCxpListItem[];
  totalRegistros: number;
  pageNumber: number;
  pageSize: number;
}
