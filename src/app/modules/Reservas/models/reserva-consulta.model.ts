import { ReservaTagResumen } from './reserva-tag.model';

export interface ReservaConsulta {
  reserva: string;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  categoria: string;
  habOrigen: string;
  agencia: string;
  descripcion: string;
  ingreso: string;
  salida: string;
  noches: number;
  habitaciones: number;
  pax: number;
  ninos: number;
  estado: string;
  total: number;
  prepago: 'S' | 'N';
  moneda: string;
  tCambio: number;
  operador: string;
  tags: ReservaTagResumen[];
  cantidadTags: number;
  tieneAlertas: boolean;
}

export interface ReservaFiltro {
  fechaInicio: string;
  fechaFinal: string;
  agencia: string;
  estado: string;
  busqueda: string;
}

export interface ReservaConsultaApiItem {
  codReserva?: string;
  codAgencia?: string;
  codTarifa?: string;
  codPlan?: string;
  categoria?: string;
  Categoria?: string;
  catHabita?: string;
  CatHabita?: string;
  cateHab?: string;
  CateHab?: string;
  habOrigen?: string;
  HabOrigen?: string;
  oldHabita?: string;
  OldHabita?: string;
  numHabita?: string;
  NumHabita?: string;
  fecIngresa?: string;
  fecSalida?: string;
  fecCreacion?: string;
  fecConfirma?: string;
  fecPrepago?: string;
  fecAnulada?: string;
  totNoches?: number;
  totDias?: number;
  descripcion?: string;
  Descripcion?: string;
  tCambio?: number;
  folio?: string;
  estado?: string;
  moneda?: string;
  totalRsv?: number;
  observacion?: string;
  observaciones?: string;
  Observacion?: string;
  Observaciones?: string;
  procesado?: number;
  directo?: string;
  operador?: string;
  prepago?: string;
  nomAgencia?: string;
  nHab?: number;
  nPax?: number;
  nChild?: number;
  prV01_CodReserva?: string;
  prV01_CodAgencia?: string;
  prV01_CodTarifa?: string;
  prV01_CodPlan?: string;
  prV01_FecIngresa?: string;
  prV01_FecSalida?: string;
  prV01_TotNoches?: number;
  prV01_Descripcion?: string;
  prV01_TCambio?: number;
  prV01_Estado?: string;
  prV01_Moneda?: string;
  prV01_TotalRsv?: number;
  prV01_Operador?: string;
  mR01_NomAgencia?: string;
  nhab?: number;
  tags?: ReservaTagResumen[] | null;
  Tags?: ReservaTagResumen[] | null;
  cantidadTags?: number;
  CantidadTags?: number;
  tieneAlertas?: boolean;
  TieneAlertas?: boolean;
}

export interface ReservaConsultaApiResponse {
  reservas?: ReservaConsultaApiItem[];
  totalRegistros?: number;
  paginaActual?: number;
  tamanoPagina?: number;
  totalPaginas?: number;
}

export interface ReservaConsultaPage {
  reservas: ReservaConsulta[];
  totalRegistros: number;
  paginaActual: number;
  tamanoPagina: number;
  totalPaginas: number;
}

export interface ReservaConsultaParams {
  fecIngreso: string;
  fecSalida: string;
  pagina: number;
  tamanoPagina: number;
  agencia?: string;
  estado?: string;
  busqueda?: string;
}
