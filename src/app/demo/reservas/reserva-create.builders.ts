import { ActividadDetalleForm, DetalleForm, ReservaCreateForm } from './reserva-create.models';

export function getTodayDateInputValue(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

export function buildInitialReservaCreateForm(now: Date = new Date()): ReservaCreateForm {
  const today = getTodayDateInputValue(now);
  return {
    fecha: today,
    codAgencia: '',
    nomCliente: '',
    telCliente: '',
    emailCliente: '',
    idioma: '',
    formaReservacion: '',
    formaPago: '',
    codLstPrecio: '',
    codPlan: '',
    moneda: '',
    directo: '0',
    estado: 'PEN',
    totalRsv: 0,
    comentarios: ''
  };
}

export function buildInitialDetalleForm(now: Date = new Date()): DetalleForm {
  const today = getTodayDateInputValue(now);
  return {
    codServicio: '',
    nomServicio: '',
    tipoServicio: '',
    fechaServicio: today,
    horaPickup: '',
    horaInicio: '',
    origenLugar: '',
    origenZona: '',
    origenDireccionGoogle: '',
    origenGoogle: '',
    origenLat: 0,
    origenLng: 0,
    origenPlaceId: '',
    destinoLugar: '',
    destinoZona: '',
    destinoDireccionGoogle: '',
    destinoGoogle: '',
    destinoLat: 0,
    destinoLng: 0,
    destinoPlaceId: '',
    montoServicio: 0,
    detallesPax: [
      {
        tipoPax: 'PAX',
        cantidad: 1,
        precioTotal: 0
      }
    ],
    estado: 'Pendiente',
    observaciones: ''
  };
}

export function buildInitialActividadDetalleForm(now: Date = new Date()): ActividadDetalleForm {
  const today = getTodayDateInputValue(now);
  return {
    codServicio: '',
    nomServicio: '',
    tipoServicio: '',
    fechaServicio: today,
    horaPickup: '',
    horaInicio: '',
    observaciones: '',
    pickups: [
      {
        direccion: '',
        zona: '',
        google: '',
        placeId: '',
        lat: 0,
        lng: 0
      }
    ],
    detallesPax: [
      {
        tipoPax: 'PAX',
        cantidad: 1,
        precioUnitario: 0
      }
    ],
    actividades: [],
    totalGeneral: 0,
    montoServicio: 0
  };
}
