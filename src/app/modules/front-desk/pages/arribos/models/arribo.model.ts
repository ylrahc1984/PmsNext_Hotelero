export interface ArribosResponse {
  success: boolean;
  message: string;
  data: ArribosData;
}

export interface ArribosData {
  resumen: ArribosResumen;
  reservas: ArriboReserva[];
}

export interface ArribosResumen {
  reservas: number;
  habitaciones: number;
  adultos: number;
  ninos: number;
}

export interface ArriboReserva {
  codReserva: string;
  descripcion: string;
  fechaIngreso: string;
  fechaSalida: string;
  estado: string;
  codPlan: string;
  noches: number;
  agencia: ArriboAgencia;
  observacion: string;
  resumen: ArriboReservaResumen;
  habitaciones: ArriboHabitacion[];
}

export interface ArriboAgencia {
  codigo: string;
  nombre: string;
}

export interface ArriboReservaResumen {
  habitacionesReservadas: number;
  habitacionesDesglosadas: number;
  adultos: number;
  ninos: number;
}

export interface ArriboHabitacion {
  numero: string;
  categoria: string;
  tipo: string;
  adultos: number;
  ninos: number;
  cpl: number;
  procesado: number;
  orden: number;
  habOrigen: string;
  huespedes: ArriboHuesped[];
}

export interface ArriboHuesped {
  nombre: string;
  apellidos: string;
}

export interface ArriboFechaViewModel {
  fecha: string;
  label: string;
  reservas: number;
  habitaciones: number;
  adultos: number;
  ninos: number;
  agencias: ArriboAgenciaViewModel[];
}

export interface ArriboAgenciaViewModel {
  codigo: string;
  nombre: string;
  reservas: number;
  habitaciones: number;
  reservasItems: ArriboReserva[];
}
