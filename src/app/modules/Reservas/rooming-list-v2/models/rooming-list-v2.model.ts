/** Identifica un desglose de una reserva para Rooming List V2. */
export interface RoomingListV2Estancia {
  codReserva: string;
  idDesglose: string;
}

/** Datos enviados para registrar o actualizar un huésped. */
export interface RoomingListV2GuardarRequest extends RoomingListV2Estancia {
  codNacion: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  apellido: string;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  tipoPax: 'PAX' | 'CHL';
  direccion?: string | null;
  email?: string | null;
  motivo?: string | null;
  procede?: string | null;
  medioArribo?: string | null;
}

/** Cuerpo requerido por desactivación y asignación de responsable. */
export interface RoomingListV2IdentificacionRequest extends RoomingListV2Estancia {}

export interface RoomingListV2Resultado {
  exito: boolean;
  mensaje: string;
  idRooming?: string | null;
  idDesglose?: string | null;
}

export interface RoomingListV2ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Huésped devuelto por GET Rooming List V2. */
export interface RoomingListV2Huesped {
  idRooming: string;
  codReserva: string;
  idDesglose: string;
  numHabita: string | null;
  codNacional: string;
  nacionalidad: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string | null;
  apellidos: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  estadoCivil: string | null;
  tipoPax: 'PAX' | 'CHL';
  direccion: string | null;
  email: string | null;
  motivo: string | null;
  procede: string | null;
  medioArribo: string | null;
  estado: string | null;
  esResponsable: boolean;
  operador: string | null;
}

/**
 * Campos usados por la futura UI; su mapping al request API se hará en otra fase.
 * Al preparar una edición, conservar los valores originales que no aparezcan
 * en el formulario, especialmente fechaNacimiento, sexo, estadoCivil y medioArribo.
 */
export interface RoomingListV2Formulario {
  codNacion: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  apellido: string;
  tipoPax: 'PAX' | 'CHL';
  email: string;
  telefono: string;
}

export interface RoomingListV2DialogContext {
  codReserva: string;
  idDesglose?: string;
  numHabita?: string;
  categoria?: string;
  tipoHabita?: string;
  fechaIngreso?: string | null;
  fechaSalida?: string | null;
  numPax?: number;
  numChild?: number;
}
