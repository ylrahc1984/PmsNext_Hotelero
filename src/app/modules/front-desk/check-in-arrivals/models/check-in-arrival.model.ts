export interface CheckInArrival {
  numHabita      : string;
  catHabita      : string;
  tipHabita      : string;
  codReserva     : string;
  codTarifa      : string;
  codPlan        : string;
  descripcion    : string;
  fechaIng       : string;
  fechaSal       : string;
  procesado      : number;
  numPax         : number;
  numChild       : number;
  cpl            : number;
  totNoches      : number;
  totDias        : number;
  folio          : string;
  estado         : string;
  codAgencia     : string;
  nomAgencia     : string;
  observacion    : string;
}

export interface CheckInArrivalKpi {
  label: string;
  value: number;
  icon: string;
  accent: 'primary' | 'blue' | 'green' | 'amber' | 'burgundy' | 'muted';
}

export type CheckInArrivalSortColumn =
  | 'numHabita'
  | 'catHabita'
  | 'tipHabita'
  | 'codReserva'
  | 'nomAgencia'
  | 'descripcion'
  | 'fechaIng'
  | 'fechaSal'
  | 'totNoches'
  | 'numPax'
  | 'numChild'
  | 'codPlan'
  | 'estado';

export type CheckInArrivalSortDirection = 'asc' | 'desc';

export interface RoomingListGuest {
  numInterno        : string;
  codReserva        : string;
  numHabita         : string;
  nacionalidad      : string;
  tipDocu           : string;
  numDocu           : string;
  nombre            : string;
  apellidos         : string;
  fecNaci           : string;
  sexo              : string;
  estCivil          : string;
  tipoPax           : string;
  direccion         : string;
  email             : string;
  motivo            : string; // Variable para Telefono
  procede           : string; // Variable para Notas
  mdoArribo         : string; // Variable para URl Foto
  orden             : number;
  operador          : string;
}

export interface RoomingListSaveRequest {
  proceso         : number;
  idOpe           : string;
  codRsv          : string;
  numHabita       : string;
  codNacion       : string;
  tipDocu         : string;
  numDocu         : string;
  nombre          : string;
  apellido        : string;
  fecNac          : string;
  sexo            : string;
  estCivil        : string;
  tiPax           : string;
  direccion       : string;
  email           : string;
  motivo          : string;
  procede         : string;
  mdoArribo       : string;
  orden           : number;
  operador        : string;
}

export interface RoomingListMutationResponse {
  success?: boolean;
  message?: string;
  respuesta?: string;
  data?: {
    idOpe?: string;
    idGenerado?: number;
    [key: string]: unknown;
  } | null;
}

export interface GuestIdentityDocument {
  idDocumento: number;
  idRooming: string;
  codReserva: string;
  tipoDocumento: string;
  ladoDocumento: string;
  nombreArchivo: string;
  formato: string;
  mimeType: string;
  tamanoBytes: number;
  activo: boolean;
  fechaCreacion: string;
  operadorCreacion: string;
  fechaModificacion?: string;
  operadorModificacion?: string;
}

export interface CheckInRequest {
  proceso         : number;
  numHabitacion   : string;
  categoria       : string;
  tipo            : string;
  codReserva      : string;
  codAgencia      : string;
  codTarifa       : string;
  codPlan         : string;
  fecIngreso      : string;
  fecSalida       : string;
  totNoches       : number;
  numPax          : number;
  numChild        : number;
  folio           : string;
  comentarios     : string;
  operador        : string;
}
