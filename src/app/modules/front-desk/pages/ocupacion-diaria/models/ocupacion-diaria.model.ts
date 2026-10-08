export type EstadoOcupacionDiaria = 'DISPONIBLE' | 'RESERVADA' | 'OCUPADA' | 'BLOQUEADA';

export interface OcupacionDiariaResponse {
  success: boolean;
  message: string;
  data: OcupacionDiariaData;
}

export interface OcupacionDiariaData {
  fecha: string;
  resumen: OcupacionDiariaResumen;
  habitaciones: OcupacionDiariaHabitacion[];
}

export interface OcupacionDiariaResumen {
  habitaciones: number;
  disponibles: number;
  reservadas: number;
  ocupadas: number;
  bloqueadas: number;
  adultos: number;
  ninos: number;
}

export interface OcupacionDiariaHabitacion {
  numeroHabitacion: number;
  reservaDescripcion: string;
  cantidadPax: number;
  cantidadNinos: number;
  agencia: string;
  tipoPlan: string;
  estado: EstadoOcupacionDiaria | string;
}

export interface OcupacionDiariaFilters {
  fecha: string;
  cateHab: string;
  codGrp: string;
  soloActivas: boolean;
}
