/** Contrato de lectura conocido para GET /reserva-completa/{codReserva}. */
export interface ReservaCompletaEncabezadoDto {
  prV01_CodReserva?: string | null;
  prV01_CodAgencia?: string | null;
  mR01_NomAgencia?: string | null;
  prV01_CodTarifa?: string | null;
  mR03_NomTarifa?: string | null;
  prV01_CodPlan?: string | null;
  mR06_PlanAlimenticio?: string | null;
  prV01_FecIngresa?: string | null;
  prV01_FecSalida?: string | null;
  prV01_FecCreacion?: string | null;
  prV01_FecConfirma?: string | null;
  prV01_FecPrepago?: string | null;
  prV01_FecAnulada?: string | null;
  prV01_TotNoches?: number | null;
  prV01_TotDias?: number | null;
  prV01_Descripcion?: string | null;
  prV01_TCambio?: number | null;
  prV01_Folio?: string | null;
  prV01_Estado?: string | null;
  prV01_Moneda?: string | null;
  prV01_TotalRsv?: number | null;
  prV01_Observacion?: string | null;
  prV01_Procesado?: number | null;
  prV01_Directo?: number | string | null;
  prV01_Operador?: string | null;
}

export interface ReservaCompletaHabitacionDto {
  prV02_CodReserva?: string | null;
  prV02_CatHabita?: string | null;
  prV02_TipHabita?: string | null;
  prV02_CantHab?: number | null;
  prV02_Precio?: number | null;
  prV02_Moneda?: string | null;
  prV02_PorDesc?: number | null;
  prV02_Total?: number | null;
  prV02_Cpl?: number | null;
  prV02_Impuesto?: number | null;
  prV02_NumPax?: number | null;
  prV02_NumChild?: number | null;
  prV02_TotChild?: number | null;
  prV02_CCosto?: string | null;
  prV02_Orden?: number | null;
  prV02_Operador?: string | null;
}

export interface ReservaCompletaInclusionDto {
  prV03_CodReserva?: string | null;
  prV03_CodServ?: string | null;
  prV03_DesServ?: string | null;
  prV03_TipPax?: string | null;
  prV03_Precio?: number | null;
  prV03_Cantidad?: number | null;
  prV03_TotServ?: number | null;
  prV03_Moneda?: string | null;
  prV03_Exonera?: number | string | null;
  prV03_Cpl?: number | null;
  prV03_ImpInc?: number | null;
  prV03_CCosto?: string | null;
  prV03_IdOrden?: number | null;
  prV03_Operador?: string | null;
}

/** Estructura adicional aún no confirmada por una definición backend disponible. */
export type ReservaCompletaServicioAdicionalDto = object;

export interface ReservaCompletaDesgloseDto {
  prV06_NumHabita?: string | null;
  prV06_CatHabita?: string | null;
  prV06_TipHabita?: string | null;
  prV06_FechaIng?: string | null;
  prV06_FechaSal?: string | null;
  prV06_Procesado?: number | null;
  prV06_NumPax?: number | null;
  prV06_NumChild?: number | null;
  prV06_Cpl?: number | null;
  prV06_Orden?: number | null;
  prV06_HabOrigen?: string | null;
  prV06_Operador?: string | null;
}

export interface ReservaCompletaContactoDto {
  prV19_Nombre?: string | null;
  prV19_Email?: string | null;
  prV19_Telefono?: string | null;
}

/** Proyección permitida para UI. Datos de tarjeta sensibles se excluyen deliberadamente. */
export interface ReservaCompletaPrepagoDto {
  prV05_FecDepo?: string | null;
  prV05_HoraReg?: string | null;
  prV05_Concepto?: string | null;
  prV05_TotalPrepa?: number | null;
  prV05_Moneda?: string | null;
  prV05_NOperacion?: string | null;
  prV05_TipTarjeta?: string | null;
}

export interface ReservaCompletaDto {
  encabezado?: ReservaCompletaEncabezadoDto | null;
  detalleHabitaciones?: ReservaCompletaHabitacionDto[] | null;
  serviciosIncluidos?: ReservaCompletaInclusionDto[] | null;
  serviciosAdicionales?: ReservaCompletaServicioAdicionalDto[] | null;
  desgloseHabitaciones?: ReservaCompletaDesgloseDto[] | null;
  contactos?: ReservaCompletaContactoDto[] | null;
  registrosPrepago?: ReservaCompletaPrepagoDto[] | null;
}

export interface ReservaHospedajeHabitacionDetalle {
  codReserva: string; catHabita: string; tipHabita: string;
  cantHab: number | null; precio: number | null; moneda: string; porDesc: number | null;
  total: number | null; cpl: number | null; impuesto: number | null; numPax: number | null;
  numChild: number | null; totChild: number | null; cCosto: string; orden: number | null; operador: string;
}

export interface ReservaHospedajeInclusionDetalle {
  codReserva: string; codServ: string; desServ: string; tipPax: string;
  precio: number | null; cantidad: number | null; totServ: number | null; moneda: string; exonera: string;
  cpl: number | null; impInc: number | null; cCosto: string; idOrden: number | null; operador: string;
}

export interface ReservaHospedajeServicioDetalle {
  codReserva: string; codSrv: string; codServ: string; descripcion: string; desServ: string; moneda: string;
  cantidad: number | null; precio: number | null; total: number | null; totServ: number | null;
  impuesto: number | null; tipPax: string; cCosto: string; idOrden: number | null; operador: string;
}

export interface ReservaHospedajeDesgloseHabitacion {
  numHabita: string; catHabita: string; tipHabita: string; fechaIngreso: string; fechaSalida: string;
  procesado: number | null; numPax: number | null; numChild: number | null; cpl: number | null;
  orden: number | null; habOrigen: string; operador: string;
}

export interface ReservaHospedajeContacto { nombre: string; email: string; telefono: string; }

export interface ReservaHospedajePrepago {
  fecha: string; hora: string; concepto: string; total: number | null; moneda: string; referencia: string; tipoTarjeta: string;
}

export interface ReservaHospedajeDetalle {
  codReserva: string; codAgencia: string; nomAgencia: string; codTarifa: string; nomTarifa: string;
  codPlan: string; planAlimenticio: string; fecIngresa: string; fecIngreso: string; fecSalida: string;
  fecCreacion: string; fecConfirma: string; fecPrepago: string; fecAnulada: string;
  totNoches: number | null; totDias: number | null; descripcion: string; tCambio: number | null;
  folio: string; estado: string; moneda: string; totalRsv: number | null; observacion: string;
  observaciones: string; procesado: number | null; directo: boolean | null; operador: string;
  habitaciones: ReservaHospedajeHabitacionDetalle[]; inclusiones: ReservaHospedajeInclusionDetalle[];
  servicios: ReservaHospedajeServicioDetalle[]; desgloseHabitaciones: ReservaHospedajeDesgloseHabitacion[];
  contactos: ReservaHospedajeContacto[]; registrosPrepago: ReservaHospedajePrepago[];
}
