import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  MutableRoomChargeHeader,
  MutableRoomChargeLine,
  RoomChargePayload,
  RoomChargeUpdateFallback
} from './room-charge-mutation.model';

export function buildRoomChargeUpdatePayload(
  header: MutableRoomChargeHeader,
  details: MutableRoomChargeLine[],
  operator: string,
  fallback: RoomChargeUpdateFallback = {}
): RoomChargePayload | null {
  if (!details.length) {
    return null;
  }

  const cleanOperator = clean(operator);
  const tipCrgHab = clean(header.tipCrgHab || fallback.tipCrgHab);
  const numCrgHab = clean(header.numCrgHab || fallback.numCrgHab);
  const codRsv = clean(header.codReserva || fallback.codRsv);
  const numHab = clean(header.numHab || fallback.numHab);
  const pntVenta = clean(header.pntVenta);
  const fecha = normalizePmsDateDDMMYYYY(header.fecha);
  const hora = formatTime(header.hora);
  const moneda = clean(header.moneda || fallback.moneda || 'USD').toUpperCase();
  const mtoTotal = round(details.reduce((sum, detail) => sum + round(Number(detail.total || 0)), 0));

  if (!tipCrgHab || !numCrgHab || !codRsv || !numHab || !pntVenta || !fecha || !cleanOperator || mtoTotal <= 0) {
    return null;
  }

  return {
    proceso: 2,
    tipCrgHab,
    numCrgHab,
    codRsv,
    numHab,
    pntVenta,
    fecha,
    hora,
    numDocu: clean(header.numDocu),
    nombrePax: clean(header.nombrePax),
    mtoTotal,
    moneda,
    cierre: toFlag(header.cierre),
    numCierre: Number(header.numCierre || 0),
    operador: cleanOperator,
    detalle: details.map((detail, index) => ({
      codRsv: clean(detail.codRsv || codRsv),
      numHab: clean(detail.numHab || numHab),
      pntVenta: clean(detail.pntVenta || pntVenta),
      fecha: normalizePmsDateDDMMYYYY(detail.fecha || fecha),
      hora: formatTime(detail.hora || hora),
      grupo: clean(detail.grupo),
      categoria: clean(detail.categoria),
      codConsumo: clean(detail.codConsumo),
      nomConsumo: clean(detail.nomConsumo),
      cantidad: Number(detail.cantidad || 0),
      precio: round(Number(detail.precio || 0)),
      total: round(Number(detail.total || 0)),
      moneda: clean(detail.moneda || moneda).toUpperCase(),
      tipNPedido: clean(detail.tipNPedido).slice(0, 3),
      numNPedido: clean(detail.numNPedido),
      codMozo: clean(detail.codMozo),
      incluido: toFlag(detail.incluido),
      exonerado: toFlag(detail.exonerado),
      orden: Number(detail.orden || index + 1),
      comentario: clean(detail.comentario),
      operador: cleanOperator
    }))
  };
}

function formatTime(value: unknown): string {
  const text = clean(value);
  const [hour, minute] = text.split(':');
  return hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : text;
}

function toFlag(value: unknown): number {
  const normalized = clean(value).toUpperCase();
  if (normalized === 'S' || normalized === 'SI' || normalized === 'TRUE') {
    return 1;
  }

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function round(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clean(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}
