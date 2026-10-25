import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { ArriboReserva } from './models/arribo.model';

export function compareArriboFechas(left: string, right: string): number {
  return dateSortKey(left).localeCompare(dateSortKey(right));
}

export function compareArriboReservas(left: ArriboReserva, right: ArriboReserva): number {
  return compareArriboFechas(left.fechaIngreso, right.fechaIngreso)
    || (left.agencia?.codigo?.trim() ?? '').localeCompare(right.agencia?.codigo?.trim() ?? '')
    || left.codReserva.trim().localeCompare(right.codReserva.trim());
}

function dateSortKey(value: string): string {
  const normalized = normalizePmsDateDDMMYYYY(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  return value.trim() ? `9999-${value.trim()}` : '9999-';
}
