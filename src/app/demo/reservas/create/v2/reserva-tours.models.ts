export interface ReservaToursDetalleServicioDto {
  linea: number;
  tipoServicio: string;
  codServicio: string;
  nomServicio: string;
  fecServicio: string;
  horaServicio: string;
  horaPickup?: string;
  origenTexto: string;
  zonaOrigen: string;
  origenGoogle: string;
  origenPlaceId: string;
  origenLat: number;
  origenLng: number;
  destinoTexto: string;
  zonaDestino: string;
  destinoGoogle: string;
  destinoPlaceId: string;
  destinoLat: number;
  destinoLng: number;
  adultos: number;
  ninos: number;
  totalPax: number;
  planTarifa: string;
  codLstPrecio: string;
  idReglaPrecio: number;
  precioAdulto: number;
  precioNino: number;
  precioPaxExtra: number;
  montoServicio: number;
  codSuplidor: string;
  subTotal: number;
  porDescuento: number;
  descuento: number;
  neto: number;
  impuesto: number;
  estado: string;
  observacion: string;
}

export interface ReservaToursDetallePasajeroDto {
  linea: number;
  tipoPax: string;
  cantidad: number;
  precioUnitarioNeto: number;
  precioUnitarioIVA: number;
  precioUnitarioTotal: number;
  subtotalNeto: number;
  subtotalIVA: number;
  subtotalTotal: number;
}

export interface ReservaToursPayloadDto {
  tipo: number;
  codReserva: string | null;
  codAgencia: string;
  idContacto: number;
  nomCliente: string;
  telCliente: string;
  emailCliente: string;
  idioma: string;
  formaReserva: string;
  formaPago: string;
  codLstPrecio: string;
  codPlan: string;
  fecCreacion: string;
  fecConfirma: string | null;
  fecAnulada: string | null;
  fecIngresa: string;
  fecSalida: string;
  fecPrepago: string | null;
  totNoches: number;
  totDias: number;
  descripcion: string;
  tCambio: number;
  folio: string;
  estado: string;
  moneda: string;
  totalRsv: number;
  observacion: string;
  procesado: number;
  directo: string;
  cntHabitaciones: number;
  operador: string;
  detalleServicios: ReservaToursDetalleServicioDto[];
  detallePasajeros: ReservaToursDetallePasajeroDto[];
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}

export interface ReservaToursSaveResponseDto {
  codReserva?: string;
  CodReserva?: string;
  PRV01_CodReserva?: string;
  mensaje?: string;
  respuesta?: string;
}

export interface ReservaToursCompletaEncabezadoDto {
  PRV01_CodReserva: string;
  PRV01_CodAgencia: string;
  NombreAgencia?: string;
  RucAgencia?: string;
  PRV01_NomCliente: string;
  PRV01_TelCliente: string;
  PRV01_EmailCliente: string;
  PRV01_Idioma: string;
  NombreIdioma?: string;
  PRV01_FormaReserva: string;
  DescripcionFormaReserva?: string;
  PRV01_FormaPago: string;
  PRV01_CodLstPrecio: string;
  PRV01_CodPlan: string;
  PRV01_FecCreacion: string;
  PRV01_FecConfirma?: unknown;
  PRV01_FecAnulada?: unknown;
  PRV01_FecIngresa?: string;
  PRV01_FecSalida?: string;
  PRV01_FecPrepago?: unknown;
  PRV01_TotNoches?: number;
  PRV01_TotDias?: number;
  PRV01_Descripcion?: string;
  PRV01_TCambio?: number;
  PRV01_Folio?: string;
  PRV01_Estado: string;
  PRV01_Moneda: string;
  PRV01_SubTotal?: number;
  PRV01_PorDescuento?: number;
  PRV01_Descuento?: number;
  PRV01_Neto?: number;
  PRV01_Impuesto?: number;
  PRV01_TotalRsv?: number;
  PRV01_Observacion?: string;
  PRV01_Procesado?: number;
  PRV01_Directo?: string;
  PRV01_CntHabitaciones?: number;
  PRV01_Operador?: string;
  PRV01_IdContacto?: number;
  PRV01_NomContactoAgencia?: string;
}

export interface ReservaToursCompletaServicioDto {
  PRV02_ID: number;
  PRV02_CodReserva: string;
  PRV02_Linea: number;
  PRV02_TipoServicio: string;
  PRV02_CodServicio: string;
  PRV02_NomServicio: string;
  DescripcionServicio?: string;
  PRV02_FecServicio: string;
  PRV02_HoraServicio: string;
  PRV02_HoraPickup?: string;
  PRV02_OrigenTexto: string;
  PRV02_ZonaOrigen: string;
  PRV02_OrigenGoogle: string;
  PRV02_OrigenPlaceId: string;
  PRV02_OrigenLat: number;
  PRV02_OrigenLng: number;
  PRV02_DestinoTexto: string;
  PRV02_ZonaDestino: string;
  PRV02_DestinoGoogle: string;
  PRV02_DestinoPlaceId: string;
  PRV02_DestinoLat: number;
  PRV02_DestinoLng: number;
  PRV02_Adultos: number;
  PRV02_Ninos: number;
  PRV02_TotalPax: number;
  PRV02_PlanTarifario: string;
  PRV02_CodLstPrecio: string;
  PRV02_IdReglaPrecio: number;
  PRV02_PrecioAdulto: number;
  PRV02_PrecioNino: number;
  PRV02_PrecioPaxExtra: number;
  PRV02_MontoServicio: number;
  PRV02_SubTotal: number;
  PRV02_PorDescuento: number;
  PRV02_Descuento: number;
  PRV02_Neto: number;
  PRV02_Impuesto: number;
  PRV02_CodSuplidor: string;
  PRV02_Estado: string;
  PRV02_Observacion: string;
}

export interface ReservaToursCompletaPasajeroDto {
  PRV03_ID: number;
  PRV03_PRV02_ID: number;
  PRV02_Linea: number;
  PRV02_NomServicio?: string;
  PRV03_TipoPax: string;
  NombreTipoPax?: string;
  OrdenTipoPax?: number;
  PRV03_Cantidad: number;
  PRV03_PrecioUnitarioNeto: number;
  PRV03_PrecioUnitarioIVA: number;
  PRV03_PrecioUnitarioTotal: number;
  PRV03_SubtotalNeto: number;
  PRV03_SubtotalIVA: number;
  PRV03_SubtotalTotal: number;
}

export interface ReservaToursCompletaResumenDto {
  cantidadServicios: number;
  totalPasajeros: number;
  cantidadTiposPax: number;
}

export interface ReservaToursCompletaResponseDto {
  encabezado: ReservaToursCompletaEncabezadoDto | null;
  servicios: ReservaToursCompletaServicioDto[];
  pasajeros: ReservaToursCompletaPasajeroDto[];
  resumen?: ReservaToursCompletaResumenDto | null;
}

