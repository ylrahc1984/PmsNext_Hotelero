export interface ComercialResumen {
  Seccion: string;
  FechaDesde: string;
  FechaHasta: string;
  Moneda: string;
  FechaDesdeAnterior: string;
  FechaHastaAnterior: string;
  Produccion: number;
  ProduccionAnterior: number;
  VariacionProduccionPct: number;
  Reservas: number;
  ReservasAnterior: number;
  VariacionReservasPct: number;
  RoomNights: number;
  RoomNightsAnterior: number;
  VariacionRoomNightsPct: number;
  ADR: number;
  ADRAnterior: number;
  VariacionADRPct: number;
  Pickup7Reservas: number;
  Pickup7RoomNights: number;
  Pickup7Produccion: number;
  Pickup30Reservas: number;
  Pickup30RoomNights: number;
  Pickup30Produccion: number;
  FechaGeneracion: string;
  GeneradoEn: string;
}

export interface ComercialCanal {
  Seccion: string;
  Canal: string;
  Reservas: number;
  Produccion: number;
  RoomNights: number;
  ADR: number;
  ParticipacionPct: number;
  Moneda: string;
}

export interface ComercialFuente {
  Seccion: string;
  Canal: string;
  Fuente: string;
  Conexion: string;
  TieneConexion: boolean;
  Reservas: number;
  Produccion: number;
  RoomNights: number;
  ADR: number;
  ParticipacionCanalPct: number;
  ParticipacionGeneralPct: number;
  Moneda: string;
}

export interface ComercialPickupSemanal {
  Seccion: string;
  NumeroSemana: number;
  Semana: string;
  FechaDesde: string;
  FechaHasta: string;
  Reservas: number;
  RoomNights: number;
  Pickup7RoomNights: number;
  Pickup7Produccion: number;
  Pickup30RoomNights: number;
  Pickup30Produccion: number;
  Pickup7Pct: number;
  Pickup30Pct: number;
  Moneda: string;
}

export interface ComercialMix {
  Seccion: string;
  Mercado: string;
  Reservas: number;
  Produccion: number;
  RoomNights: number;
  ADR: number;
  ParticipacionProduccionPct: number;
  ParticipacionRoomNightsPct: number;
  ParticipacionReservasPct: number;
  Pickup7RoomNights: number;
  Pickup7Produccion: number;
  Pickup30RoomNights: number;
  Pickup30Produccion: number;
  Moneda: string;
}

export interface ComercialComparativo {
  Seccion: string;
  Dimension: string;
  Elemento: string;
  ReservasActual: number;
  ReservasAnterior: number;
  VariacionReservasPct: number;
  ProduccionActual: number;
  ProduccionAnterior: number;
  VariacionProduccion: number;
  VariacionProduccionPct: number;
  RoomNightsActual: number;
  RoomNightsAnterior: number;
  VariacionRoomNights: number;
  VariacionRoomNightsPct: number;
  ADRActual: number;
  ADRAnterior: number;
  VariacionADR: number;
  VariacionADRPct: number;
  Tendencia: string;
  Clasificacion: string;
  Moneda: string;
}

export interface ComercialOportunidad {
  Seccion: string;
  IdOportunidad: number;
  Tipo: string;
  Prioridad: string;
  Dimension: string;
  Elemento: string;
  Titulo: string;
  Descripcion: string;
  ProduccionActual: number;
  ProduccionAnterior: number;
  VariacionProduccion: number;
  VariacionProduccionPct: number;
  RoomNightsActual: number;
  RoomNightsAnterior: number;
  VariacionRoomNightsPct: number;
  ADRActual: number;
  ADRAnterior: number;
  VariacionADRPct: number;
  ValorReferencia: number;
  Moneda: string;
}

export interface ComercialDiagnostico {
  Seccion: string;
  EstadoCalidad: string;
  TotalReservas: number;
  ReservasSinClasificar: number;
  ReservasSinMercado: number;
  ChannelManagerSinCanal: number;
  ReservasSinDetalleHabitacion: number;
  ReservasSinRoomNights: number;
  ReservasSinProduccion: number;
  ReservasTipoCambioInvalido: number;
  ProduccionControl: number;
  ProduccionCanalesControl: number;
  DiferenciaProduccion: number;
  Moneda: string;
  FechaDesde: string;
  FechaHasta: string;
  GeneradoEn: string;
}

export interface ComercialIncidencia {
  Seccion: string;
  CodReserva: string;
  CodAgencia: string;
  Agencia: string;
  FechaIngreso: string;
  FechaSalida: string;
  TipoCanal: string;
  FuenteVenta: string;
  CanalOrigen: unknown;
  Mercado: string;
  MonedaOriginal: string;
  TipoCambio: number;
  Produccion: number;
  TipoIncidencia: string;
}

export interface ComercialReportResponse {
  resumen: ComercialResumen[];
  canales: ComercialCanal[];
  fuentes: ComercialFuente[];
  pickupSemanal: ComercialPickupSemanal[];
  mixComercial: ComercialMix[];
  comparativo: ComercialComparativo[];
  oportunidades: ComercialOportunidad[];
  diagnostico: ComercialDiagnostico[];
  incidencias: ComercialIncidencia[];
}

export interface ComercialReportFilters {
  fechaDesde: string;
  fechaHasta: string;
  moneda: string;
}
