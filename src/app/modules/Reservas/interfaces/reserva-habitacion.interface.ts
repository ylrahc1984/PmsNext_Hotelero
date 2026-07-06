export type ReservaEstado = 'ABI' | 'WLI' | 'CCR' | 'CHK' | 'WLT' | 'ANU';

export interface ReservaHabitacionItem {
  categoria: string;
  tipo: string;
  cantidad: number;
  precio: number;
  cantidadNinos: number;
  precioNino: number;
  total: number;
}

export interface ReservaInclusionItem {
  codServ: string;
  desServ: string;
  tipPax: string;
  precio: number;
  cantidad: number;
  totServ: number;
}

export interface ReservaServicioItem {
  codSrv: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  impuesto: number;
  tipPax: string;
  total: number;
}

export interface ReservaHabitacionRequestItem {
  catHabita: string;
  tipHabita: string;
  cantHab: number;
  precio: number;
  moneda: string;
  total: number;
  cpl: number;
  impuesto: number;
  numPax: number;
  numChild: number;
  totChild: number;
  cCosto: string;
  orden: number;
}

export interface ReservaInclusionRequestItem {
  codServ: string;
  desServ: string;
  tipPax: string;
  precio: number;
  cantidad: number;
  totServ: number;
  exonera: string;
  cpl: number;
  impInc: number;
  cCosto: string;
  orden: number;
}

export interface ReservaServicioRequestItem {
  codSrv: string;
  descripcion: string;
  moneda: string;
  cantidad: number;
  precio: number;
  total: number;
  impuesto: number;
  tipPax: string;
  cCosto: string;
}

export interface ReservaHabitacionRequest {
  proceso: number;
  codReserva: string;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  fecIngreso: string;
  fecSalida: string;
  fecCreacion: string;
  fecConfirma: string;
  fecPrepago: string;
  fecAnulada: string;
  totNoches: number;
  totDias: number;
  descripcion: string;
  tCambio: number;
  folio: string;
  estado: ReservaEstado | string;
  moneda: string;
  totalRsv: number;
  observaciones: string;
  procesa: number;
  directo: string;
  operador: string;
  habitaciones: ReservaHabitacionRequestItem[];
  inclusiones: ReservaInclusionRequestItem[];
  servicios: ReservaServicioRequestItem[];
}

export interface ReservaHabitacionResponse {
  ok?: boolean;
  codReserva?: string;
  respuesta?: string;
  mensaje?: string;
  datos?: ReservaHabitacionRequest | null;
}
