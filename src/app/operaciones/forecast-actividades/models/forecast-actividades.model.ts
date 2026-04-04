export type ForecastSemaforoSaturacion = 'baja' | 'media' | 'alta' | 'critica';

export interface ForecastActividadesResponse {
  totalRegistros: number;
  bloques: ForecastBloqueHoraResponse[];
  totalesGenerales: ForecastTotalesGeneralesResponse;
  resumenActividadPorHora: ForecastResumenActividadHoraResponse[];
}

export interface ForecastBloqueHoraResponse {
  bloqueHora: string;
  totalesHora: ForecastTotalesHoraResponse;
  detalles: ForecastOperacionDetalle[];
}

export interface ForecastTotalesHoraResponse {
  totalHora: number;
  paxHora: number;
  cantidadServicios: number;
}

export interface ForecastTotalesGeneralesResponse {
  totalGeneral: number;
  totalPaxGeneral: number;
  totalServicios: number;
}

export interface ForecastOperacionDetalle {
  prV02_ID: number;
  prV02_CodReserva: string;
  prV02_FecServicio: string;
  prV02_HoraServicio: string;
  bloqueHora?: string;
  codAgencia: string;
  agencia: string;
  cliente: string;
  lugarPickup: string;
  formaPago: string;
  planTarifa: string;
  tipoTarifa: string;
  totalServicio: number;
  estado: string;
  procesado: number | boolean | null;
  facturado: 0 | 1 | boolean;
  totalPax: number;
  codServicio: string;
  nomServicio: string;
  observacion: string;
  chofer: string | null;
  usuario: string;
  observacionOperacion: string | null;
}

export interface ForecastResumenActividadHoraResponse {
  bloqueHora: string;
  codServicio: string;
  nomServicio: string;
  totalActividadHora: number;
  paxActividadHora: number;
  cantidadServicios: number;
}

export interface ForecastCapacidadProyectada {
  capacidadMaxima: number;
  cuposOcupados: number;
  cuposDisponibles: number;
  porcentajeOcupacion: number;
  semaforoSaturacion: ForecastSemaforoSaturacion;
  disponibilidadReal: boolean;
  capacidadVendibleFutura: number;
}

export interface ForecastBloqueOperativo extends ForecastCapacidadProyectada {
  key: string;
  fecha: string;
  hora: string;
  codServicio: string;
  nomServicio: string;
  totalPax: number;
  cantidadServicios: number;
  totalMonetario: number;
  procesados: number;
  noProcesados: number;
  estadoProceso: 'pendiente' | 'parcial' | 'procesado';
  agencias: string[];
  clientes: string[];
  pickups: string[];
  choferes: string[];
  estados: string[];
  observaciones: string[];
  observacionesOperacion: string[];
  tieneObservacion: boolean;
  tieneChofer: boolean;
  detalles: ForecastOperacionDetalle[];
}

export interface ForecastMatrizCelda {
  fecha: string;
  bloques: ForecastBloqueOperativo[];
  totalPax: number;
  totalServicios: number;
  totalMonetario: number;
}

export interface ForecastMatrizActividad {
  codServicio: string;
  nomServicio: string;
  fechas: ForecastMatrizCelda[];
  totalPax: number;
  totalServicios: number;
  totalMonetario: number;
}

export interface ForecastMatrizResultado {
  fechas: string[];
  filas: ForecastMatrizActividad[];
  agencias: string[];
  bloquesHora: string[];
  bloquesFlat: ForecastBloqueOperativo[];
}

export interface ForecastKpis {
  totalServicios: number;
  totalPasajeros: number;
  totalMonetario: number;
  bloqueMasCargado: string;
  actividadMasDemandada: string;
  actividadesActivas: number;
}
