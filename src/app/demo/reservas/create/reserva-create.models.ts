export type ReservaEstado = 'PEN' | 'CON' | 'CAN';

export interface ReservaCreateForm {
  fecha                 : string;
  codAgencia            : string;
  idContacto            : number;
  nomContactoAgencia    : string;
  nomCliente            : string;
  telCliente            : string;
  emailCliente          : string;
  idioma                : string;
  formaReservacion      : string;
  formaPago             : string;
  codLstPrecio          : string;
  codPlan               : string;
  moneda                : string;
  directo               : string;
  estado                : ReservaEstado;
  totalRsv              : number;
  comentarios           : string;
}

export interface DetallePaxForm {
  tipoPax             : string;
  cantidad            : number;
  precioTotal         : number;
  precioUnitario     ?: number;
  precioPaxExtra     ?: number;
  reglaPrecioId      ?: number;
  error              ?: string;
  manual             ?: boolean;
}

export interface ActividadPickupForm {
  direccion   : string;
  zona        : string;
  google      : string;
  placeId     : string;
  lat         : number;
  lng         : number;
  error      ?: string;
}

export interface ActividadPaxForm {
  tipoPax          : string;
  cantidad         : number;
  precioUnitario   : number;
  error           ?: string;
}

export interface Tarifa {
  tipoPax?: string;
  tipo: string;
  precio: number;
  cantidad: number;
  total: number;
}

export interface ActividadDetalle {
  codServicio: string;
  nomServicio: string;
  tipoServicio?: string;
  reglaPrecioID: number;
  tarifas: Tarifa[];
  totalLinea: number;
}

export interface ActividadDetalleForm {
  codPlan?: string;
  planTarifa?: string;
  codLstPrecio?: string;
  codServicio: string;
  nomServicio: string;
  tipoServicio: string;
  fechaServicio: string;
  horaPickup: string;
  horaInicio?: string;
  observaciones?: string;
  pickups: ActividadPickupForm[];
  detallesPax: ActividadPaxForm[];
  actividades?: ActividadDetalle[];
  totalGeneral?: number;
  montoServicio: number;
}

// No se usa DetalleForm para la API, pero se mantiene para el modal local
export interface DetalleForm {
  codPlan                 ?: string;
  planTarifa              ?: string;
  codLstPrecio            ?: string;
  codServicio             : string;
  nomServicio             : string;
  tipoServicio            : string;
  fechaServicio           : string;
  horaPickup              : string;
  horaInicio              : string;
  origenLugar             : string;
  origenZona              : string;
  origenDireccionGoogle   : string;
  origenGoogle            : string;
  origenLat               : number;
  origenLng               : number;
  origenPlaceId           : string;
  destinoLugar            : string;
  destinoZona             : string;
  destinoDireccionGoogle  : string;
  destinoGoogle           : string;
  destinoLat              : number;
  destinoLng              : number;
  destinoPlaceId          : string;
  montoServicio           : number;
  detallesPax             : DetallePaxForm[];
  estado                  : string;
  observaciones           ?: string;
}
