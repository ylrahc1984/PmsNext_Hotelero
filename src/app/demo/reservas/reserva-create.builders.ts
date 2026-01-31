import { DetalleForm, ReservaCreateForm } from './reserva-create.models';

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
    moneda: '',
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
    adultos: 1,
    ninos: 0,
    totalPax: 0,
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
    tarifa: 'A',
    costoNeto: 0,
    costoRack: 0,
    montoServicio: 0,
    estado: 'Pendiente',
    observaciones: ''
  };
}
