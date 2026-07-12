import { ReservaConsulta } from '../../models/reserva-consulta.model';

export type ReservationPrepaymentMode = 'new' | 'edit' | 'view';

export interface ReservationPrepayment {
  proceso: number;
  numInterno: string;
  codRsv: string;
  codAge: string;
  fechaDepo: string;
  fechaReg: string;
  horaReg: string;
  concepto: string;
  cCosto: string;
  totalRsv: number;
  totalPrepa: number;
  saldoPrepa: number;
  moneda: string;
  tCambio: number;
  frmPago: string;
  numTarjeta: string;
  venTarjeta: string;
  codSeguridad: string;
  tipTarjeta: string;
  nOperacion: string;
  codBanco: string;
  ctaBanco: string;
  procesado: number;
  cierre: number;
  numCierre: number;
  empresa: string;
  operador: string;
}

export interface ReservationPrepaymentResponse {
  ok?: boolean;
  respuesta?: string;
  mensaje?: string;
  datos?: ReservationPrepayment[] | ReservationPrepayment | null;
  prepagos?: ReservationPrepayment[];
}

export interface ReservationPrepaymentHistoryItem {
  proceso?: number;
  numInterno?: string;
  codReserva?: string;
  codAgen?: string;
  fecDepo?: string;
  fechaReg?: string;
  horaReg?: string;
  concepto?: string;
  cCosto?: string;
  totalRsv?: number;
  totalPrepa?: number;
  saldoPrepa?: number;
  moneda?: string;
  tCambio?: number;
  frmPago?: string;
  numTarjeta?: string;
  venTarjeta?: string;
  codSeguridad?: string;
  tipTarjeta?: string;
  nOperacion?: string;
  codBanco?: string;
  ctaBanco?: string;
  procesado?: number;
  cierre?: number;
  numCierre?: number;
  empresa?: string;
  operador?: string;
}

export interface ReservationPrepaymentSummary {
  codReserva: string;
  codAgencia: string;
  agencia: string;
  cliente: string;
  ingreso: string;
  salida: string;
  estado: string;
  totalRsv: number;
  totalPrepa: number;
  saldoPrepa: number;
  moneda: string;
  tCambio: number;
  operador: string;
}

export function buildReservationPrepaymentSummary(reserva: ReservaConsulta): ReservationPrepaymentSummary {
  const totalRsv = Number(reserva.total ?? 0) || 0;
  // `prepago` en la consulta es únicamente un indicador S/N, no un monto.
  const totalPrepa = 0;

  return {
    codReserva: reserva.reserva,
    codAgencia: reserva.codAgencia,
    agencia: reserva.agencia,
    cliente: reserva.descripcion,
    ingreso: reserva.ingreso,
    salida: reserva.salida,
    estado: reserva.estado,
    totalRsv,
    totalPrepa,
    saldoPrepa: Math.max(totalRsv - totalPrepa, 0),
    moneda: reserva.moneda || 'USD',
    tCambio: Number(reserva.tCambio ?? 0) || 1,
    operador: reserva.operador
  };
}
