export interface ServicioReserva {
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  moneda: string;
  precio: number | null;
  total: number | null;
  tipoPax: string;
  centroCosto: string;
}

export interface ReservaServicios {
  reservaId: string;
  reservaDescripcion: string;
  fechaIngreso: string;
  fechaSalida: string;
  estadoReserva: string;
  observacionReserva: string;
  nombreAgencia: string;
  codigoPlan: string;
  totalNoches: number;
  agenciaId: string;
  cantidadAdultos: number;
  cantidadNinos: number;
  totalHuespedes: number;
  servicios: ServicioReserva[];
}

export interface ReporteArribosResponse {
  success: boolean;
  message: string;
  data: ReservaServicios[];
}

export interface ReporteArribosParams {
  fechaIngreso: string;
  fechaSalida: string;
  operador?: string;
}

export interface AgenciaServicioOption {
  id: string;
  nombre: string;
}

export interface ResumenMonedaServicios {
  moneda: string;
  total: number;
  registrosConTotal: number;
}
