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

export interface WalkInOption {
  codigo: string;
  descripcion: string;
}

export interface WalkInTarifaOption extends WalkInOption {
  moneda: string;
  tarifaNoche: number;
}

export interface WalkInAgenciaOption extends WalkInOption {
  email: string;
}
