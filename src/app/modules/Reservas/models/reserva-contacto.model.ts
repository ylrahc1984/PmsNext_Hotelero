export interface ReservaContactoApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ReservaContacto {
  idContacto: number;
  codReserva: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  fechaCreacion: string | null;
  operadorCreacion: string | null;
  fechaModificacion: string | null;
  operadorModificacion: string | null;
}

export interface GuardarReservaContactoRequest {
  nombre: string;
  email: string | null;
  telefono: string | null;
}
