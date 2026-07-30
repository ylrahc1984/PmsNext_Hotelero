import { ReservaEstado } from 'src/app/modules/Reservas/interfaces/reserva-habitacion.interface';

export type EstadoValidacionImportacion = 'PENDIENTE' | 'VALIDA' | 'ADVERTENCIA' | 'ERROR';
export type EstadoImportacion = 'PENDIENTE' | 'PROCESANDO' | 'IMPORTADA' | 'ERROR' | 'OMITIDA';

export interface HabitacionImportacion {
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

export interface ReservaImportacion {
  id: string;
  filaExcel: number;
  numeroExterno: string;
  estadoOrigen: string;
  tarifaOrigen: string;
  cplOrigen: string;
  nombre: string;
  nacionalidad: string;
  telefono: string;
  fechaEntrada: string;
  fechaSalida: string;
  fechaCreacion: string;
  fechaAnulada: string;
  noches: number;
  habitaciones: number;
  pax: number;
  total: number;
  impuesto: number;
  neto: number;
  depositado: number;
  pendiente: number;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  estadoPms: ReservaEstado | '';
  directo: 'S' | 'N';
  moneda: string;
  detalleHabitaciones: HabitacionImportacion[];
  estadoValidacion: EstadoValidacionImportacion;
  errores: string[];
  advertencias: string[];
  seleccionado: boolean;
  estadoImportacion: EstadoImportacion;
  codReservaPms?: string;
  mensajeImportacion?: string;
}

export interface HomologacionTarifa {
  origen: string;
  cantidad: number;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  directo: 'S' | 'N';
}

export interface HomologacionEstado {
  origen: string;
  cantidad: number;
  estadoPms: ReservaEstado | '';
}

export interface ResumenImportacion {
  reservas: number;
  habitaciones: number;
  noches: number;
  pax: number;
  total: number;
  depositado: number;
  pendientesHomologacion: number;
  advertencias: number;
  errores: number;
}

export interface ResultadoLecturaExcel {
  reservas: ReservaImportacion[];
  filasIgnoradas: number;
  nombreHoja: string;
}

export interface FiltrosMigracion {
  busqueda: string;
  validacion: 'TODAS' | EstadoValidacionImportacion;
  tarifaOrigen: string;
  agencia: string;
  categoria: string;
  fechaEntrada: string;
}

export const ESTADOS_RESERVA_PMS: ReadonlyArray<{ codigo: ReservaEstado; descripcion: string }> = [
  { codigo: 'ABI', descripcion: 'Abierta' },
  { codigo: 'WLI', descripcion: 'Walk In' },
  { codigo: 'CCR', descripcion: 'Confirmada' },
  { codigo: 'CHK', descripcion: 'Check-in' },
  { codigo: 'WLT', descripcion: 'Lista de espera' },
  { codigo: 'ANU', descripcion: 'Anulada' }
];

