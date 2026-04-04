import { ReservaCreateForm, ReservaEstado } from '../reserva-create.models';

export type ReservaDraftServiceSource = 'transfer' | 'actividad';

export interface ReservaDraftPassengerLine {
  tipoPax                 : string;
  cantidad                : number;
  precioUnitarioNeto      : number;
  precioUnitarioIVA       : number;
  precioUnitarioTotal     : number;
  subtotalNeto            : number;
  subtotalIVA             : number;
  subtotalTotal           : number;
  reglaPrecioId           ?: number;
  precioPaxExtra          ?: number;
  manual                  ?: boolean;
  error                   ?: string;
}

export interface ReservaDraftServiceLine {
  linea               : number;
  source              : ReservaDraftServiceSource;
  tipoServicio        : string;
  codServicio         : string;
  nomServicio         : string;
  fecServicio         : string;
  horaServicio        : string;
  horaPickup         ?: string;
  origenTexto         : string;
  zonaOrigen          : string;
  origenGoogle        : string;
  origenPlaceId       : string;
  origenLat           : number;
  origenLng           : number;
  destinoTexto        : string;
  zonaDestino         : string;
  destinoGoogle       : string;
  destinoPlaceId      : string;
  destinoLat          : number;
  destinoLng          : number;
  adultos             : number;
  ninos               : number;
  totalPax            : number;
  planTarifa          : string;
  codLstPrecio        : string;
  codPlan             : string;
  idReglaPrecio       : number;
  precioAdulto        : number;
  precioNino          : number;
  precioPaxExtra      : number;
  montoServicio       : number;
  codSuplidor         : string;
  subTotal            : number;
  porDescuento        : number;
  descuento           : number;
  neto                : number;
  impuesto            : number;
  estado              : string;
  observacion         : string;
  pasajeros           : ReservaDraftPassengerLine[];
}

export interface ReservaCreateV2HeaderDraft extends ReservaCreateForm {
  codReserva      ?: string;
  fecConfirma     : string;
  fecAnulada      : string;
  fecIngresa      : string;
  fecSalida       : string;
  fecPrepago      : string;
  descripcion     : string;
  tCambio         : number;
  folio           : string;
  procesado       : number;
  cntHabitaciones : number;
  operador        : string;
}

export interface ReservaCreateV2Draft {
  header      : ReservaCreateV2HeaderDraft;
  servicios   : ReservaDraftServiceLine[];
}

export interface ReservaDraftTotals {
  totalServicios    : number;
  totalNeto         : number;
  totalImpuesto     : number;
}

export interface ReservaDraftCalculationOptions {
  pricesIncludeTax    : boolean;
  taxRate             : number;
  descuentoDefault    : number;
  redondeoDecimales   : number;
}

export interface ReservaDraftBuildOptions {
  estado      ?: ReservaEstado;
  operador    ?: string;
}
