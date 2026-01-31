export type ReservaEstado = 'PEN' | 'CON' | 'CAN';

export interface ReservaCreateForm {
  fecha: string;
  codAgencia: string;
  nomCliente: string;
  telCliente: string;
  emailCliente: string;
  idioma: string;
  formaReservacion: string;
  formaPago: string;
  codLstPrecio: string;
  moneda: string;
  estado: ReservaEstado;
  totalRsv: number;
  comentarios: string;
}

// No se usa DetalleForm para la API, pero se mantiene para el modal local
export interface DetalleForm {
  codServicio: string;
  nomServicio: string;
  tipoServicio: string;
  fechaServicio: string;
  horaPickup: string;
  horaInicio: string;
  adultos: number;
  ninos: number;
  totalPax: number;
  origenLugar: string;
  origenZona: string;
  origenDireccionGoogle: string;
  origenGoogle: string;
  origenLat: number;
  origenLng: number;
  origenPlaceId: string;
  destinoLugar: string;
  destinoZona: string;
  destinoDireccionGoogle: string;
  destinoGoogle: string;
  destinoLat: number;
  destinoLng: number;
  destinoPlaceId: string;
  tarifa: string;
  costoNeto: number;
  costoRack: number;
  montoServicio: number;
  estado: string;
  observaciones?: string;
}
