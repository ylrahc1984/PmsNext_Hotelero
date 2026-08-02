/** Contrato de fecha simple utilizado por el PMS y el backend: DD/MM/YYYY. */
export function normalizePmsDateDDMMYYYY(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocalDate(value);
  }

  const normalized = (value ?? '').toString().replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    return formatValidDate(Number(isoDate[3]), Number(isoDate[2]), Number(isoDate[1]));
  }

  const namedMonthDate = normalized.match(/^([a-z]{3})\s+(\d{1,2})\s+(\d{4})$/i);
  if (namedMonthDate) {
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
      namedMonthDate[1].toLowerCase()
    );

    return month >= 0 ? formatValidDate(Number(namedMonthDate[2]), month + 1, Number(namedMonthDate[3])) : '';
  }

  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?=$|[ T])/);
  if (!slashDate) {
    return '';
  }

  const firstPart = Number(slashDate[1]);
  const secondPart = Number(slashDate[2]);
  const year = Number(slashDate[3]);
  const isUnambiguousUsDate = firstPart >= 1 && firstPart <= 12 && secondPart > 12 && secondPart <= 31;
  const day = isUnambiguousUsDate ? secondPart : firstPart;
  const month = isUnambiguousUsDate ? firstPart : secondPart;

  return formatValidDate(day, month, year);
}

/**
 * Valida una fecha escrita por el usuario en orden D/M/YYYY o DD/MM/YYYY y
 * devuelve siempre el contrato canónico DD/MM/YYYY.
 *
 * A diferencia de normalizePmsDateDDMMYYYY, esta función no acepta fechas ISO,
 * horas ni texto adicional: está destinada a controles editables.
 */
export function normalizePmsDateInputDDMMYYYY(value: unknown): string {
  const input = (value ?? '').toString().trim();
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  return match
    ? formatValidDate(Number(match[1]), Number(match[2]), Number(match[3]))
    : '';
}

/** Formatea fecha y hora local garantizando DD/MM/YYYY HH:mm. */
export function formatPmsDateTimeDDMMYYYY(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }

  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${formatLocalDate(value)} ${hours}:${minutes}`;
}

export function toPmsDateInputValue(value: unknown): string {
  const normalized = normalizePmsDateDDMMYYYY(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** Suma días calendario en hora local, sin depender de milisegundos ni cambios de zona horaria. */
export function addPmsCalendarDays(value: unknown, days: number): Date | null {
  const date = value instanceof Date ? new Date(value) : parsePmsDate(value);

  if (!date || Number.isNaN(date.getTime()) || !Number.isFinite(days)) {
    return null;
  }

  date.setDate(date.getDate() + Math.trunc(days));
  return date;
}

/** Diferencia entre fechas civiles, independiente de zona horaria y horario de verano. */
export function differenceInPmsCalendarDays(startValue: unknown, endValue: unknown): number | null {
  const startParts = getNormalizedDateParts(startValue);
  const endParts = getNormalizedDateParts(endValue);

  if (!startParts || !endParts) {
    return null;
  }

  const startOrdinal = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endOrdinal = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  return Math.round((endOrdinal - startOrdinal) / 86400000);
}

export function parsePmsDate(value: unknown): Date | null {
  const parts = getNormalizedDateParts(value);
  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month - 1, parts.day);
}

function formatLocalDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatValidDate(day: number, month: number, year: number): string {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return '';
  }

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function getNormalizedDateParts(value: unknown): { day: number; month: number; year: number } | null {
  const normalized = normalizePmsDateDDMMYYYY(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  return match
    ? {
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3])
      }
    : null;
}
