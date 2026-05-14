export interface CentroOperacionalParams {
  fechaInicio: string;
  fechaFin: string;
  busqueda?: string;
  agenciaId?: string;
  choferId?: string;
  page?: number;
  pageSize?: number;
}

export interface CentroOperacionalResponse {
  totalRegistros: number;
  bloques: CentroOperacionalBloque[];
  totalesGenerales: CentroOperacionalTotalesGenerales;
  resumenActividadPorHora: CentroOperacionalActividadHora[];
}

export interface CentroOperacionalBloque {
  bloqueHora: string;
  totalesHora: CentroOperacionalTotalesHora;
  detalles: CentroOperacionalDetalle[];
}

export interface CentroOperacionalTotalesHora {
  totalHora: number;
  paxHora: number;
  cantidadServicios: number;
}

export interface CentroOperacionalDetalle {
  prV02_ID: number;
  prV02_CodReserva: string;
  prV02_FecServicio: string;
  prV02_HoraServicio: string;
  bloqueHora: string;
  codAgencia: string;
  agencia: string;
  cliente: string;
  lugarPickup: string;
  formaPago: string;
  planTarifa: string;
  tipoTarifa: string;
  totalServicio: number;
  estado: string;
  procesado: boolean;
  totalPax: number;
  codServicio: string;
  nomServicio: string;
  observacion: string;
  chofer: string;
  usuario: string;
  facturado: number;
  observacionOperacion: string;
}

export interface CentroOperacionalTotalesGenerales {
  totalGeneral: number;
  totalPaxGeneral: number;
  totalServicios: number;
}

export interface CentroOperacionalActividadHora {
  bloqueHora: string;
  codServicio: string;
  nomServicio: string;
  totalActividadHora: number;
  paxActividadHora: number;
  cantidadServicios: number;
}

export type CentroNivelOperacion = 'normal' | 'medio' | 'alto' | 'critico';

export interface CentroKpi {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: CentroNivelOperacion | 'neutral';
}

export interface CentroTimelineBlock {
  bloqueHora: string;
  paxHora: number;
  totalHora: number;
  cantidadServicios: number;
  nivel: CentroNivelOperacion;
  intensidad: number;
}

export interface CentroHeatmapRow {
  codServicio: string;
  nomServicio: string;
  totalPax: number;
  totalServicios: number;
  cells: CentroHeatmapCell[];
}

export interface CentroHeatmapCell {
  bloqueHora: string;
  paxActividadHora: number;
  cantidadServicios: number;
  totalActividadHora: number;
  nivel: CentroNivelOperacion;
}

export interface CentroActividadCard {
  codServicio: string;
  nomServicio: string;
  totalPax: number;
  totalServicios: number;
  totalIngreso: number;
  nivel: CentroNivelOperacion;
  peakHour: string;
  trend: 'ascendente' | 'estable' | 'descendente';
  bars: CentroActividadBar[];
}

export interface CentroActividadBar {
  bloqueHora: string;
  paxActividadHora: number;
  cantidadServicios: number;
  width: number;
  nivel: CentroNivelOperacion;
}

export interface CentroDetalleBloque {
  bloqueHora: string;
  paxHora: number;
  cantidadServicios: number;
  totalHora: number;
  nivel: CentroNivelOperacion;
  detalles: CentroOperacionalDetalle[];
}

export interface CentroOperacionMatrixRow {
  codServicio: string;
  nomServicio: string;
  totalPax: number;
  totalServicios: number;
  totalIngreso: number;
  nivel: CentroNivelOperacion;
  peakHour: string;
  detalles: CentroOperacionalDetalle[];
  cells: CentroOperacionMatrixCell[];
}

export interface CentroOperacionMatrixCell {
  bloqueHora: string;
  paxActividadHora: number;
  cantidadServicios: number;
  totalActividadHora: number;
  nivel: CentroNivelOperacion;
  intensidad: number;
}

export interface CentroOperacionalViewModel {
  totalRegistros: number;
  nivelDia: CentroNivelOperacion;
  nivelDiaLabel: string;
  kpis: CentroKpi[];
  timeline: CentroTimelineBlock[];
  heatmapColumns: string[];
  heatmap: CentroHeatmapRow[];
  actividades: CentroActividadCard[];
  matrizOperacional: CentroOperacionMatrixRow[];
  detalles: CentroDetalleBloque[];
  alertas: string[];
}
