import { RoomRackNavigationState } from '../../pages/room-rack/models/room-rack-room.model';

export interface WalkInGuest {
  id: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nacionalidad: string;
  nombre: string;
  apellidos: string;
  direccion: string;
  correo: string;
  fechaNacimiento: string;
  tipoPax: string;
  creditoActivo: boolean;
}

export interface WalkInStay {
  fechaEntrada: string;
  fechaSalida: string;
  noches: number;
  habitacion: number;
  cantidadPax: number;
  cantidadChildren: number;
  agenciaCodigo: string;
  agenciaNombre: string;
  tarifaCodigo: string;
  tarifaDescripcion: string;
  tarifaNoche: number;
  moneda: string;
  planAlimentacion: string;
  observaciones: string;
}

export interface WalkInSummary {
  habitacion: number;
  noches: number;
  pax: number;
  children: number;
  tarifaNoche: number;
  totalHabitacion: number;
  totalServicios: number;
  totalIncluido: number;
  total: number;
}

export interface WalkInRequest {
  estancia: WalkInStay;
  huespedes: WalkInGuest[];
  habitacionSeleccionada: RoomRackNavigationState | null;
}

export interface WalkInSavePayload {
  proceso: number;
  codReserva: string;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
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
  observaciones: string;
  procesa: number;
  numHabitacion: string;
  categoria: string;
  tipo: string;
  numPax: number;
  numChild: number;
  lCredito: number;
  mtoCredito: number;
  numTarjeta: string;
  vence: string;
  autoriza: string;
  tarifa: number;
  operador: string;
  detHab: WalkInDetHab[];
  detInclu: WalkInDetInclu[];
  detSrv: WalkInDetSrv[];
  detRoom: WalkInDetRoom[];
}

export interface WalkInDetHab {
  catHabita: string;
  tipHabita: string;
  cantHab: number;
  precio: number;
  moneda: string;
  total: number;
  cpl: number;
  impuesto: number;
  numPax: number;
  numChild: number;
  totChild: number;
  cCosto: string;
  orden: number;
}

export interface WalkInDetInclu {
  codServ: string;
  desServ: string;
  tipPax: string;
  precio: number;
  cantidad: number;
  totServ: number;
  exonera: string;
  cpl: number;
  impInc: number;
  cCosto: string;
  orden: number;
}

export interface WalkInDetSrv {
  codSrv: string;
  descripcion: string;
  moneda: string;
  cantidad: number;
  precio: number;
  total: number;
  impuesto: number;
  tipPax: string;
  cCosto: string;
}

export interface WalkInDetRoom {
  numHabita: string;
  codNacional: string;
  tipDocu: string;
  numDocu: string;
  nombre: string;
  apellidos: string;
  fecNaci: string;
  sexo: string;
  estCivil: string;
  tipoPax: string;
  direccion: string;
  email: string;
  motivo: string;
  procede: string;
  mdoArribo: string;
  orden: number;
  operador: string;
}

export interface WalkInOption {
  codigo: string;
  descripcion: string;
}

export interface WalkInTarifaOption extends WalkInOption {
  moneda: string;
  tarifaNoche: number;
  fechaInicial?: string;
  fechaFinal?: string;
  activo?: boolean;
  operador?: string;
}

export interface WalkInAgenciaOption extends WalkInOption {
  email: string;
  ruc?: string;
  contacto?: string;
  telefono?: string;
  ciudad?: string;
  pais?: string;
  mercado?: string;
  activo?: boolean;
}

export interface WalkInAgenciaPage {
  datos: WalkInAgenciaOption[];
  totalRegistros: number;
  paginaActual: number;
  tamanoPagina: number;
  totalPaginas: number;
}
