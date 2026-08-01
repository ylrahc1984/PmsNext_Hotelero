export type LimpiezaHabitacionValor = string | number | boolean | null;

export interface LimpiezaHabitacion {
  room: string;
  fechaIni: string;
  fechaFin: string;
  huesped: string;
  numPax: number;
  estado: string;
  clean: LimpiezaHabitacionValor;
  grupo: string;
  numChl: number;
}

export interface LimpiezaHabitacionesResponse {
  respuesta: string;
  habitaciones: LimpiezaHabitacion[];
}

export type EstadoLimpiezaVisual = 'PENDIENTE' | 'LIMPIA' | 'EN PROCESO' | 'INSPECCION';

export type PrioridadHousekeeping = 'SALIDA HOY' | 'LLEGADA' | 'OCUPADA' | 'LIBRE' | 'OTRA';

export interface LimpiezaHabitacionVista extends LimpiezaHabitacion {
  estadoLimpieza: EstadoLimpiezaVisual;
  prioridad: PrioridadHousekeeping;
  prioridadOrden: number;
}

export interface LimpiezaHabitacionesKpis {
  total: number;
  salidasHoy: number;
  llegadas: number;
  ocupadas: number;
  pendientes: number;
  limpias: number;
}

export interface LimpiezaHabitacionesPdfData {
  fechaOperativa: string;
  operador: string;
  habitaciones: LimpiezaHabitacionVista[];
  kpis: LimpiezaHabitacionesKpis;
  generadoEn: Date;
}
