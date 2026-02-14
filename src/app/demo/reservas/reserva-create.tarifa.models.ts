export interface MejorPrecioReglaDto {
  ReglaPrecioID: number;
  PrecioID: number;
  PlanID: number;
  NombrePlan: string;
  MPV04_CodLstPrecio: string;
  MPV04_DesLstPrecio: string;
  MPV05_CodServicio: string;
  MPV05_TipoTarifa: string | number;
  MPV05_CantMinPax: number;
  MPV05_CantMaxPax: number;
  MPV05_HoraDesde: string;
  MPV05_HoraHasta: string;
  MPV06_TipoPaxCodigo: string;
  PrecioBase: number;
  PrecioPaxExtra: number;
  MPV06_CantMaxPax: number;
  PaxIncluidos: number;
  PaxExtras: number;
  PrecioTotalCalculado: number;
  MPV06_PorcentajeComision: number;
  MPV06_MontoComision: number;
  ScoreCoincidencia: number;
  MPV04_Moneda: string;
  MPV04_Simbolo: string;
  ListaVigenteDesde: string;
  ListaVigenteHasta: string;
}

export interface MejorPrecioRegla {
  reglaPrecioId: number;
  precioId: number;
  planId: number;
  nombrePlan: string;
  codLstPrecio: string;
  desLstPrecio: string;
  codServicio: string;
  tipoTarifa: string;
  cantMinPax: number;
  cantMaxPax: number;
  horaDesde: string;
  horaHasta: string;
  tipoPaxCodigo: string;
  precioBase: number;
  precioPaxExtra: number;
  cantMaxPaxTipo: number;
  paxIncluidos: number;
  paxExtras: number;
  precioTotalCalculado: number;
  porcentajeComision: number;
  montoComision: number;
  scoreCoincidencia: number;
  moneda: string;
  simbolo: string;
  listaVigenteDesde: string;
  listaVigenteHasta: string;
}

export interface ReglaTarifaAplicada {
  idReglaPrecio: number;
  precioAdulto: number;
  precioNino: number;
  precioPaxExtra: number;
  paxExtras: number;
  montoServicio: number;
  moneda: string;
  simbolo: string;
  detalleAdultos?: MejorPrecioRegla;
  detalleNinos?: MejorPrecioRegla;
}

export interface DetallePrecioServicioApiItem {
  ReglaPrecioID: number;
  CodLstPrecio?: string;
  CodServicio: string;
  NomServicio: string;
  TipoTarifa?: string;
  CantMinPax?: number;
  CantMaxPax?: number;
  HoraDesde?: string;
  HoraHasta?: string;
  Moneda?: string;
  Precios: Array<{
    tipoPax?: string | null;
    descripcion?: string | null;
    precio: number;
    precioExtra?: number | null;
    maxPax?: number | null;
    comision?: number | null;
    // Compatibilidad con variantes anteriores.
    tipo?: string | null;
    extra?: number | null;
    max?: number | null;
  }>;
}

export interface DetallePrecioServicioApiResponse {
  datos?: DetallePrecioServicioApiItem[];
}

export interface DetallePrecioServicioQuery {
  codLstPrecio: string;
  codServicio?: string;
  nombreServicio?: string;
  pageNumber?: number;
  pageSize?: number;
}
