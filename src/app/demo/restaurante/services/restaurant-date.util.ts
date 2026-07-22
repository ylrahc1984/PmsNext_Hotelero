/**
 * Normaliza las fechas usadas por restaurante al contrato DD/MM/YYYY.
 *
 * Algunas instalaciones SQL/API serializan fechas con la cultura en-US
 * (MM/DD/YYYY). Cuando el segundo bloque es mayor que 12 el orden es
 * inequívoco y se intercambian mes y día. Las fechas ambiguas (por ejemplo
 * 07/08/2026) se conservan como DD/MM/YYYY, que es el contrato del backend.
 */
export function normalizeRestaurantDateDDMMYYYY(value: unknown): string {
  const normalized = (value ?? '').toString().replace(/\s+/g, ' ').trim();
  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (slashDate) {
    const firstPart = Number(slashDate[1]);
    const secondPart = Number(slashDate[2]);
    const year = Number(slashDate[3]);
    const isUsDate = firstPart >= 1 && firstPart <= 12 && secondPart > 12 && secondPart <= 31;
    const day = isUsDate ? secondPart : firstPart;
    const month = isUsDate ? firstPart : secondPart;

    if (isValidCalendarDate(day, month, year)) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }

    return normalized;
  }

  const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);

    if (isValidCalendarDate(day, month, year)) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  return normalized;
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
