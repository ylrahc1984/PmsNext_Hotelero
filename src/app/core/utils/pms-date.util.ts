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

  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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

export function toPmsDateInputValue(value: unknown): string {
  const normalized = normalizePmsDateDDMMYYYY(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

export function parsePmsDate(value: unknown): Date | null {
  const normalized = normalizePmsDateDDMMYYYY(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
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
