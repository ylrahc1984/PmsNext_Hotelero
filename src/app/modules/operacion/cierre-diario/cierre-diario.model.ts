export interface CierreDiarioValidacionDetalle {
  codigo: string;
  validacion: string;
  pendientes: number;
  bloqueaCierre: boolean;
}

export interface CierreDiarioValidacionResumen {
  fechaValidada: string;
  esValido: boolean;
  totalPendientes: number;
  habitacionesSinCheckOut: number;
  mesasAbiertas: number;
  habitacionesSinLimpieza: number;
  puntosVentaSinCierre: number;
  reservasSinCheckIn: number;
  mensaje: string;
}

export interface CierreDiarioParametrosSalida {
  esValido: boolean;
  mensaje: string;
  cantHabSinCheckout: number;
  cantMesasAbiertas: number;
  cantHabSinLimpieza: number;
  cantPvSinCierre: number;
  cantResSinCheckin: number;
  totalPendientes: number;
}

export interface CierreDiarioValidacionData {
  resumen: CierreDiarioValidacionResumen;
  detalles: CierreDiarioValidacionDetalle[];
  parametrosSalida: CierreDiarioParametrosSalida;
}

export interface CierreDiarioValidacionResponse {
  success: boolean;
  message: string;
  data: CierreDiarioValidacionData;
}

export interface EjecutarCierreDiarioRequest {
  empresa: string;
  operador: string;
}

export interface EjecutarCierreDiarioResponse {
  success: boolean;
  empresa: string;
  fechaAnterior: string;
  nuevaFechaOperativa: string;
  fechaHoraCierre: string;
  operador: string;
  mensaje: string;
}
