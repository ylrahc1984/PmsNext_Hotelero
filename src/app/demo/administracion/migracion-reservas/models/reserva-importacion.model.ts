import { ReservaEstado } from 'src/app/modules/Reservas/interfaces/reserva-habitacion.interface';

export type EstadoValidacionImportacion = 'PENDIENTE' | 'VALIDA' | 'ADVERTENCIA' | 'ERROR';
export type EstadoImportacion = 'PENDIENTE' | 'PROCESANDO' | 'IMPORTADA' | 'ERROR' | 'OMITIDA';
export type OrigenHomologacion = 'AUTOMATICA' | 'MANUAL' | 'PENDIENTE';

export interface LineaReservaOrigen {
  filaExcel: number;
  idReservaOrigen: string;
  numeroReservaOrigen: string;
  nombre: string;
  nombreReservante: string;
  telefono: string;
  email: string;
  observaciones: string;
  referencia: string;
  otaId: string;
  idNacionalidadOrigen: string;
  nacionalidadOrigen: string;
  vip: string;
  idEstadoOrigen: string;
  estadoOrigen: string;
  idContratoOrigen: string;
  contratoOrigen: string;
  idOrigen: string;
  origen: string;
  fechaEntrada: string;
  fechaSalida: string;
  fechaReserva: string;
  fechaAnulada: string;
  nochesCabecera: number;
  cantidadHabitacionesCabecera: number;
  paxTotalCabecera: number;
  totalReservaCabecera: number;
  prepagadoCabecera: number;
  idMonedaOrigen: string;
  codigoMonedaOrigen: string;
  descripcionMonedaOrigen: string;
  idCategoriaOrigen: string;
  codigoCategoriaOrigen: string;
  descripcionCategoriaOrigen: string;
  idHabitacionOrigen: string;
  habitacionOrigen: string;
  maxAdultos: number;
  maxNinos: number;
  cplOrigen: number;
}

export interface HabitacionImportacion {
  filaExcel?: number;
  idCategoriaOrigen?: string;
  codigoCategoriaOrigen?: string;
  descripcionCategoriaOrigen?: string;
  idHabitacionOrigen?: string;
  habitacionOrigen?: string;
  categoriaOrigen?: string;
  maxAdultos?: number;
  maxNinos?: number;
  fechaEntradaOrigen?: string;
  fechaSalidaOrigen?: string;
  homologacionCategoria?: OrigenHomologacion;
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
  errores: string[];
  advertencias: string[];
  estadoValidacion?: EstadoValidacionImportacion;
}

export interface ReservaImportacion {
  id: string;
  idReservaOrigen: string;
  filaExcel: number;
  filasExcel: number[];
  numeroExterno: string;
  nombreReservante: string;
  estadoOrigen: string;
  tarifaOrigen: string;
  idContratoOrigen: string;
  contratoOrigen: string;
  idOrigen: string;
  origen: string;
  cplOrigen: string;
  nombre: string;
  nacionalidad: string;
  telefono: string;
  email: string;
  otaId: string;
  comentarios: string;
  referencia: string;
  idNacionalidadOrigen: string;
  vip: string;
  idEstadoOrigen: string;
  fechaEntrada: string;
  fechaSalida: string;
  fechaCreacion: string;
  fechaAnulada: string;
  noches: number;
  nochesOrigen: number;
  habitaciones: number;
  lineasHabitacion: number;
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
  idMonedaOrigen: string;
  monedaOrigen: string;
  descripcionMonedaOrigen: string;
  moneda: string;
  tipoCambio: number;
  detalleHabitaciones: HabitacionImportacion[];
  parserErrores: string[];
  parserAdvertencias: string[];
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
  lineas: number;
  reservas: number;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  directo: 'S' | 'N';
}

export interface HomologacionCategoria {
  origen: string;
  codigoOrigen?: string;
  descripcionOrigen?: string;
  lineas: number;
  catHabita: string;
  coincidencia: OrigenHomologacion;
}

export interface HomologacionEstado {
  origen: string;
  cantidad: number;
  estadoPms: ReservaEstado | '';
}

export interface ResumenImportacion {
  reservas: number;
  lineasHabitacion: number;
  habitaciones: number;
  noches: number;
  pax: number;
  total: number;
  depositado: number;
  pendientesHomologacion: number;
  categoriasHomologadas: number;
  advertencias: number;
  errores: number;
  listas: number;
  fechaMinima: string;
  fechaMaxima: string;
}

export interface ResultadoLecturaExcel {
  formato: 'RESERVAS_ALT';
  reservas: ReservaImportacion[];
  lineasHabitacion: number;
  filasIgnoradas: number;
  nombreHoja: string;
  categoriasOrigen: string[];
  tarifasOrigen: string[];
  estadosOrigen: string[];
  monedasOrigen: string[];
}

export interface FiltrosMigracion {
  busqueda: string;
  validacion: 'TODAS' | 'REVISION' | EstadoValidacionImportacion;
  tarifaOrigen: string;
  agencia: string;
  categoria: string;
  plan: string;
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
