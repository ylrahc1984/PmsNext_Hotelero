export interface ReservaCompletaEncabezadoDto {
  prV01_CodReserva?: string;
  prV01_CodAgencia?: string;
  mR01_NomAgencia?: string;
  prV01_CodTarifa?: string;
  mR03_NomTarifa?: string;
  prV01_CodPlan?: string;
  mR06_PlanAlimenticio?: string;
  prV01_FecIngresa?: string;
  prV01_FecSalida?: string;
  prV01_FecCreacion?: string;
  prV01_FecConfirma?: string;
  prV01_FecPrepago?: string;
  prV01_FecAnulada?: string;
  prV01_TotNoches?: number;
  prV01_TotDias?: number;
  prV01_Descripcion?: string;
  prV01_TCambio?: number;
  prV01_Folio?: string;
  prV01_Estado?: string;
  prV01_Moneda?: string;
  prV01_TotalRsv?: number;
  prV01_Observacion?: string;
  prV01_Procesado?: number;
  prV01_Directo?: number | string;
  prV01_Operador?: string;
}

export interface ReservaCompletaHabitacionDto {
  prV02_CodReserva?: string;
  prV02_CatHabita?: string;
  prV02_TipHabita?: string;
  prV02_CantHab?: number;
  prV02_Precio?: number;
  prV02_Moneda?: string;
  prV02_PorDesc?: number;
  prV02_Total?: number;
  prV02_Cpl?: number;
  prV02_Impuesto?: number;
  prV02_NumPax?: number;
  prV02_NumChild?: number;
  prV02_TotChild?: number;
  prV02_CCosto?: string;
  prV02_Orden?: number;
  prV02_Operador?: string;
}

export interface ReservaCompletaInclusionDto {
  prV03_CodReserva?: string;
  prV03_CodServ?: string;
  prV03_DesServ?: string;
  prV03_TipPax?: string;
  prV03_Precio?: number;
  prV03_Cantidad?: number;
  prV03_TotServ?: number;
  prV03_Moneda?: string;
  prV03_Exonera?: number | string;
  prV03_Cpl?: number;
  prV03_ImpInc?: number;
  prV03_CCosto?: string;
  prV03_IdOrden?: number;
  prV03_Operador?: string;
}

export type ReservaCompletaServicioAdicionalDto = Record<string, unknown>;

export interface ReservaCompletaDesgloseDto {
  prV06_NumHabita?: string;
  prV06_CatHabita?: string;
  prV06_TipHabita?: string;
  prV06_FechaIng?: string;
  prV06_FechaSal?: string;
  prV06_Procesado?: number;
  prV06_NumPax?: number;
  prV06_NumChild?: number;
  prV06_Cpl?: number;
  prV06_Orden?: number;
  prV06_HabOrigen?: string;
  prV06_Operador?: string;
}

export interface ReservaCompletaDto {
  encabezado?: ReservaCompletaEncabezadoDto | null;
  detalleHabitaciones?: ReservaCompletaHabitacionDto[] | null;
  serviciosIncluidos?: ReservaCompletaInclusionDto[] | null;
  serviciosAdicionales?: ReservaCompletaServicioAdicionalDto[] | null;
  desgloseHabitaciones?: ReservaCompletaDesgloseDto[] | null;
}

export interface ReservaHospedajeHabitacionDetalle {
  codReserva: string;
  catHabita: string;
  tipHabita: string;
  cantHab: number;
  precio: number;
  moneda: string;
  porDesc: number;
  total: number;
  cpl: number;
  impuesto: number;
  numPax: number;
  numChild: number;
  totChild: number;
  cCosto: string;
  orden: number;
  operador: string;
}

export interface ReservaHospedajeInclusionDetalle {
  codReserva: string;
  codServ: string;
  desServ: string;
  tipPax: string;
  precio: number;
  cantidad: number;
  totServ: number;
  moneda: string;
  exonera: string;
  cpl: number;
  impInc: number;
  cCosto: string;
  idOrden: number;
  operador: string;
}

export interface ReservaHospedajeServicioDetalle {
  codReserva: string;
  codSrv: string;
  codServ: string;
  descripcion: string;
  desServ: string;
  moneda: string;
  cantidad: number;
  precio: number;
  total: number;
  totServ: number;
  impuesto: number;
  tipPax: string;
  cCosto: string;
  idOrden: number;
  operador: string;
}

export interface ReservaHospedajeDesgloseHabitacion {
  numHabita: string;
  catHabita: string;
  tipHabita: string;
  fechaIngreso: string;
  fechaSalida: string;
  procesado: number;
  numPax: number;
  numChild: number;
  cpl: number;
  orden: number;
  habOrigen: string;
  operador: string;
}

export interface ReservaHospedajeDetalle {
  codReserva: string;
  codAgencia: string;
  nomAgencia: string;
  codTarifa: string;
  nomTarifa: string;
  codPlan: string;
  planAlimenticio: string;
  fecIngresa: string;
  fecIngreso: string;
  fecSalida: string;
  fecCreacion: string;
  fecConfirma: string;
  fecPrepago: string;
  fecAnulada: string;
  totNoches: number;
  totDias: number;
  descripcion: string;
  tCambio: number;
  folio: string;
  estado: string;
  moneda: string;
  totalRsv: number;
  observacion: string;
  observaciones: string;
  procesado: number;
  directo: boolean;
  operador: string;
  habitaciones: ReservaHospedajeHabitacionDetalle[];
  inclusiones: ReservaHospedajeInclusionDetalle[];
  servicios: ReservaHospedajeServicioDetalle[];
  desgloseHabitaciones: ReservaHospedajeDesgloseHabitacion[];
}
