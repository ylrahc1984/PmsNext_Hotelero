import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import {
  GuestContactCategory,
  GuestExportRow,
  GuestLocalFilters,
  GuestReportKpis,
  NationalityChartItem,
  ReporteHuespedMercadeo
} from './analisis-huespedes.models';

const DOCUMENT_PLACEHOLDERS = new Set(['0', '0000000000', 'SINDOCUMENTO', 'N/A', 'NA']);

export const guestDateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const from = String(control.get('fechaDesde')?.value ?? '');
  const to = String(control.get('fechaHasta')?.value ?? '');
  return from && to && from > to ? { invalidDateRange: true } : null;
};

export function normalizeGuestText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function normalizeDocumentNumber(value: unknown): string {
  return normalizeGuestText(value).replace(/[\s-]+/g, '');
}

export function hasUsableDocument(value: unknown): boolean {
  const normalized = normalizeDocumentNumber(value);
  return normalized.length > 0 && !DOCUMENT_PLACEHOLDERS.has(normalized);
}

export function guestIdentityKey(guest: ReporteHuespedMercadeo): string {
  if (hasUsableDocument(guest.numeroDocumento)) {
    return `DOC:${normalizeGuestText(guest.tipoDocumento) || 'SIN TIPO'}:${normalizeDocumentNumber(guest.numeroDocumento)}`;
  }

  return `PERSONA:${normalizeGuestText(guest.nombreCompleto)}:${normalizeGuestText(guest.codNacionalidad) || 'SIN NACIONALIDAD'}`;
}

export function classifyGuestContact(guest: ReporteHuespedMercadeo): GuestContactCategory {
  const emailType = normalizeGuestText(guest.tipoEmail);
  if (emailType === 'CORREO DIRECTO') return 'CORREO DIRECTO';
  if (emailType === 'OTA BOOKING' || emailType === 'OTA EXPEDIA') return 'CORREO OTA';
  if (!String(guest.email ?? '').trim() && String(guest.telefono ?? '').trim()) return 'SOLO TELÉFONO';
  return 'SIN CONTACTO';
}

export function filterGuestRows(rows: readonly ReporteHuespedMercadeo[], filters: GuestLocalFilters): ReporteHuespedMercadeo[] {
  const term = normalizeGuestText(filters.search);
  return rows.filter((guest) => {
    if (filters.nacionalidad && guest.nacionalidad !== filters.nacionalidad) return false;
    if (filters.agencia && guest.nomAgencia !== filters.agencia) return false;
    if (filters.estadoContacto && guest.estadoContacto !== filters.estadoContacto) return false;
    if (filters.tipoEmail && guest.tipoEmail !== filters.tipoEmail) return false;
    if (filters.estadoReserva && guest.estadoReserva !== filters.estadoReserva) return false;
    if (filters.tipoPax && guest.tipoPax !== filters.tipoPax) return false;
    if (filters.origenReserva === 'DIRECTA' && normalizeGuestText(guest.esReservaDirecta) !== 'S') return false;
    if (filters.origenReserva === 'AGENCIA' && normalizeGuestText(guest.esReservaDirecta) === 'S') return false;

    if (!term) return true;
    return [
      guest.nombreCompleto,
      guest.codReserva,
      guest.numeroDocumento,
      guest.email,
      guest.telefono,
      guest.nacionalidad,
      guest.nomAgencia
    ].some((value) => normalizeGuestText(value).includes(term));
  });
}

export function buildGuestKpis(rows: readonly ReporteHuespedMercadeo[]): GuestReportKpis {
  const total = rows.length;
  const contactables = rows.filter((guest) => guest.esContactable === true).length;
  const directEmails = rows.filter((guest) => normalizeGuestText(guest.tipoEmail) === 'CORREO DIRECTO').length;
  const nationalities = new Set(rows.map((guest) => normalizeGuestText(guest.nacionalidad)).filter(Boolean));

  return {
    paxAlojados: total,
    huespedesUnicos: new Set(rows.map(guestIdentityKey)).size,
    nacionalidades: nationalities.size,
    contactables,
    contactablesPercentage: percentage(contactables, total),
    correosDirectos: directEmails,
    correosDirectosPercentage: percentage(directEmails, total)
  };
}

export function buildNationalityChart(rows: readonly ReporteHuespedMercadeo[], limit = 8): NationalityChartItem[] {
  const counts = new Map<string, number>();
  rows.forEach((guest) => {
    const label = String(guest.nacionalidad ?? '').trim() || 'SIN CLASIFICAR';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const sorted = [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: percentage(count, rows.length) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es', { sensitivity: 'base' }));
  if (sorted.length <= limit) return sorted;

  const visible = sorted.slice(0, limit);
  const otherCount = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return [...visible, { label: 'Otros', count: otherCount, percentage: percentage(otherCount, rows.length) }];
}

export function buildContactCounts(rows: readonly ReporteHuespedMercadeo[]): Record<GuestContactCategory, number> {
  const counts: Record<GuestContactCategory, number> = {
    'CORREO DIRECTO': 0,
    'CORREO OTA': 0,
    'SOLO TELÉFONO': 0,
    'SIN CONTACTO': 0
  };
  rows.forEach((guest) => (counts[classifyGuestContact(guest)] += 1));
  return counts;
}

export function toGuestApiDate(value: string): string {
  return normalizePmsDateDDMMYYYY(value);
}

export function buildGuestExportRows(rows: readonly ReporteHuespedMercadeo[]): GuestExportRow[] {
  return rows.map((guest) => ({
    Reserva: guest.codReserva,
    Huésped: guest.nombreCompleto,
    'Tipo de documento': guest.tipoDocumento ?? '',
    'Número de documento': guest.numeroDocumento ?? '',
    Nacionalidad: guest.nacionalidad || 'SIN CLASIFICAR',
    Correo: guest.email ?? '',
    'Tipo de correo': guest.tipoEmail,
    Teléfono: guest.telefono ?? '',
    'Estado de contacto': guest.estadoContacto,
    'Fecha de ingreso': normalizePmsDateDDMMYYYY(guest.fechaIngreso),
    'Fecha de salida': normalizePmsDateDDMMYYYY(guest.fechaSalida),
    Noches: Number(guest.noches) || 0,
    Agencia: guest.nomAgencia,
    Tarifa: guest.codTarifa,
    Plan: guest.codPlan,
    'Estado de reserva': guest.estadoReserva,
    'Reserva directa': normalizeGuestText(guest.esReservaDirecta) === 'S' ? 'Sí' : 'No'
  }));
}

export function firstDayOfMonthInput(dateValue: unknown): string {
  const input = toPmsDateInputValue(dateValue);
  return input ? `${input.slice(0, 8)}01` : '';
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
