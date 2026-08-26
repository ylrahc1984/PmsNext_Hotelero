export interface ReporteHuespedMercadeo {
  idRooming: number;
  codReserva: string;
  numHabitacion: string;
  nombreCompleto: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  codNacionalidad: string;
  nacionalidad: string;
  email: string | null;
  tipoEmail: string;
  telefono: string | null;
  estadoContacto: string;
  esContactable: boolean;
  tipoPax: string | null;
  fechaIngreso: string;
  fechaSalida: string;
  noches: number;
  codAgencia: string;
  nomAgencia: string;
  codTarifa: string;
  codPlan: string;
  estadoReserva: string;
  esReservaDirecta: string;
  operadorReserva: string;
  registrosMismaEstancia: number;
  fueConsolidado: boolean;
}

export type GuestContactCategory = 'CORREO DIRECTO' | 'CORREO OTA' | 'SOLO TELÉFONO' | 'SIN CONTACTO';

export type GuestSortColumn = 'nombreCompleto' | 'nacionalidad' | 'fechaIngreso' | 'fechaSalida' | 'noches' | 'nomAgencia';

export type SortDirection = 'asc' | 'desc';

export interface GuestLocalFilters {
  search: string;
  nacionalidad: string;
  agencia: string;
  estadoContacto: string;
  tipoEmail: string;
  origenReserva: string;
  estadoReserva: string;
  tipoPax: string;
}

export interface NationalityChartItem {
  label: string;
  count: number;
  percentage: number;
}

export interface GuestReportKpis {
  paxAlojados: number;
  huespedesUnicos: number;
  nacionalidades: number;
  contactables: number;
  contactablesPercentage: number;
  correosDirectos: number;
  correosDirectosPercentage: number;
}

export interface GuestExportRow {
  Reserva: string;
  Huésped: string;
  'Tipo de documento': string;
  'Número de documento': string;
  Nacionalidad: string;
  Correo: string;
  'Tipo de correo': string;
  Teléfono: string;
  'Estado de contacto': string;
  'Fecha de ingreso': string;
  'Fecha de salida': string;
  Noches: number;
  Agencia: string;
  Tarifa: string;
  Plan: string;
  'Estado de reserva': string;
  'Reserva directa': string;
}
