export interface RetiroCxpFactura {
  tipoDocu: string;
  numDocu: string;
  tipDocPrv: string;
  serieDocPrv: string;
  numFacPrv: string;
  fechaCobra?: string;
  fechaVen?: string;
  tipoPago: string;
  totalDocu: number;
  moneda: string;
  montoPago: number;
  tCambio?: number;
  estado?: string;
  descripcion: string;
  tipoOpe: string;
  saldo?: number;
}

export interface RetiroCxpDetalleContable {
  codConcepto: string;
  concepto: string;
  moneda: string;
  monto: number;
  tCambio: number;
  numAsientoObs: string;
  operador: string;
}

export interface RetiroCxp {
  idOperacion?: string;
  codBanco: string;
  codCtaBanco: string;
  fecha: string;
  numBeneficiario: string;
  beneficiario: string;
  concepto: string;
  numOperacion: string;
  tipoOperacion: string;
  moneda: string;
  monto: number;
  tCambio: number;
  operador: string;
  empresa: string;
  movCon?: number | string | boolean;
  fechaCon: string;
  operCon: string;
  detalle: RetiroCxpDetalleContable[];
  pagos: RetiroCxpFactura[];
}

export interface RetiroCxpListItem {
  idOperacion: string;
  codBanco: string;
  ctaBanco: string;
  fecha: string;
  numOperacion: string;
  tipoOperacion: string;
  concepto: string;
  moneda: string;
  montoTotal: number;
  codProve: string;
  nomProve: string;
  movCon?: string | boolean;
  estado?: string;
}

export interface RetiroCxpFilters {
  codBanco?: string;
  codCtaBanco?: string;
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
