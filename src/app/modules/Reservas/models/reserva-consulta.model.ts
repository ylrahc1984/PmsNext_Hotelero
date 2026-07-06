export interface ReservaConsulta {
  reserva: string;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
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
  moneda: string;
  operador: string;
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
  fecIngresa?: string;
  fecSalida?: string;
  fecCreacion?: string;
  fecConfirma?: string;
  fecPrepago?: string;
  fecAnulada?: string;
  totNoches?: number;
  totDias?: number;
  descripcion?: string;
  tCambio?: number;
  folio?: string;
  estado?: string;
  moneda?: string;
  totalRsv?: number;
  observacion?: string;
  procesado?: number;
  directo?: string;
  operador?: string;
  prepago?: string;
  nomAgencia?: string;
  nHab?: number;
  nPax?: number;
  nChild?: number;
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
