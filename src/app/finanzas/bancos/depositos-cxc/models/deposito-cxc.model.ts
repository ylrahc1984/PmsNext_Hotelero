export interface DepositoCxcDetalle {
  codConcepto: string;
  descripcion: string;
  moneda: string;
  monto: number;
  tCambio: number;
}

export interface DepositoCxcCobranza {
  tipoDocu: string;
  serie: string;
  numDocu: string;
  fechaCobra: string;
  tipo: string;
  moneda: string;
  montoPago: number;
  tCambio: number;
  estado: string;
  descripcion: string;
  frmPago: string;
  referencia: string;
}

export interface DepositoCxc {
  idOperacion?: string;
  codBanco: string;
  codCtaBanco: string;
  fecha: string;
  numDepositante: string;
  depositante: string;
  concepto: string;
  frmPago: string;
  numOpera: string;
  moneda: string;
  monto: number;
  tCambio: number;
  operador: string;
  empresa: string;
  movCon: number;
  fechaCon: string;
  operCon: string;
  detalle: DepositoCxcDetalle[];
  cobranzas: DepositoCxcCobranza[];
}

export interface DepositoCxcListItem {
  idOperacion: string;
  codBanco: string;
  codCtaBanco: string;
  fecha: string;
  numOpera: string;
  depositante: string;
  monto: number;
  moneda: string;
  movCon?: number | boolean;
}

export interface DepositoCxcFilters {
  codBanco?: string;
  codCtaBanco?: string;
  fechaInicio?: string;
  fechaFin?: string;
  pageNumber: number;
  pageSize: number;
}

export interface DepositoCxcResponse {
  datos: DepositoCxcListItem[];
  totalRegistros: number;
  pageNumber: number;
  pageSize: number;
}
