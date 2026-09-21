export type EstadoSolicitudHuesped = 'PEN' | 'ATE' | 'COM' | 'CAN';

export interface SolicitudHuesped {
  idSolicitud: number;
  idPortal: number | null;
  idDesglose: number | null;
  codReserva: string | null;
  idRooming: number | null;
  numHabitacion: string | null;
  idTipoSolicitud: number | null;
  tipoSolicitud: string;
  area: string;
  cantidad: number | null;
  comentario: string | null;
  estado: EstadoSolicitudHuesped;
  fechaSolicitud: string;
  fechaAtencion: string | null;
  fechaCompletada: string | null;
  fechaCancelada: string | null;
  operadorAtencion: string | null;
  operadorCompleta: string | null;
  observacionInterna: string | null;
  minutosDesdeSolicitud: number | null;
}

export interface SolicitudesHuespedFiltros {
  estado?: EstadoSolicitudHuesped;
  area?: string;
}

export interface SolicitudesHuespedApiResponse {
  success: boolean;
  message: string;
  data: SolicitudHuesped[];
}

export interface SolicitudHuespedOperacionRequest {
  observacionInterna?: string;
}

export interface SolicitudHuespedTipo {
  idTipoSolicitud: number;
  nombre: string;
  descripcion: string | null;
  area: string;
  icono: string | null;
  orden: number;
  permiteCantidad: boolean;
  requiereComentario: boolean;
}

export interface SolicitudHuespedCrearRequest {
  idDesglose: number;
  idRooming: number | null;
  idTipoSolicitud: number;
  cantidad: number | null;
  comentario: string | null;
}

export interface SolicitudesHuespedTiposApiResponse {
  success: boolean;
  message: string;
  data: SolicitudHuespedTipo[];
}

export interface SolicitudHuespedCrearApiResponse {
  success: boolean;
  message: string;
  data: SolicitudHuesped;
}

export type AccionSolicitudHuesped = 'atender' | 'completar' | 'cancelar';

export interface SolicitudHuespedKpis {
  PEN: number;
  ATE: number;
  COM: number;
  CAN: number;
}
