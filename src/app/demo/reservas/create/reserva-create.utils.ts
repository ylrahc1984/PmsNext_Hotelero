import { ReservaEstado } from './reserva-create.models';

export function toDateInputValue(value: unknown): string {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  const isoLike = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }

  // Formato común en sistemas ES: dd/MM/yyyy
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function safeString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function hasCoordinates(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export function normalizeReservaEstado(estado: string): ReservaEstado {
  const v = (estado || '').toString().trim().toUpperCase();
  if (v === 'PEN' || v === 'PENDIENTE') return 'PEN';
  if (v === 'CON' || v === 'CONFIRMADA' || v === 'CONFIRMADO') return 'CON';
  if (v === 'CAN' || v === 'ANULADA' || v === 'ANULADO') return 'CAN';
  return 'PEN';
}

export function extractCodReserva(res: any): string | null {
  // La API puede devolver PRV01_CodReserva o { datos: [{ CodReserva: '...' }] }
  return res?.PRV01_CodReserva || res?.CodReserva || res?.datos?.[0]?.CodReserva || res?.datos?.[0]?.PRV01_CodReserva || null;
}

export function parseCodigoValue(value: unknown): string | null {
  const str = (value ?? '').toString().trim();
  if (!str) return null;
  // Si viene un numero como string "1" o "2", NO es un código (es id).
  const asNumber = Number(str);
  if (Number.isFinite(asNumber) && /^\d+$/.test(str)) return null;
  return str;
}

export function parseNumericId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

export function safeJsonStringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function safeJsonParse<T = any>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function extractGoogleFormattedAddress(value: unknown): string {
  const obj = safeJsonParse<any>(value);
  const formatted =
    obj?.formattedAddress ?? obj?.formatted_address ?? obj?.address ?? obj?.description ?? obj?.name ?? obj?.formatted_address ?? '';
  return safeString(formatted);
}

export function extractGoogleDisplayText(value: unknown): string {
  const obj = safeJsonParse<any>(value);
  if (!obj) return safeString(value);

  const displayText = safeString(obj?.displayText ?? '');
  if (displayText) return displayText;

  const name = safeString(obj?.name ?? obj?.displayName?.text ?? obj?.displayName ?? '');
  const formatted = safeString(obj?.formattedAddress ?? obj?.formatted_address ?? obj?.address ?? obj?.description ?? '');

  if (name && formatted) {
    return formatted.toLowerCase().includes(name.toLowerCase()) ? formatted : `${name}, ${formatted}`;
  }

  return name || formatted;
}
