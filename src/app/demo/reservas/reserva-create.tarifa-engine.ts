import { ReglaTarifa } from '../catalogos/listas-precios/listas-precios.service';

/**
 * Utilidades puras (sin dependencias de UI) para evaluar y calcular reglas tarifarias.
 * Este archivo se mantiene libre de `HttpClient`/services para facilitar pruebas y reutilización.
 */

/**
 * Normaliza el rango de pax (adultos) de una regla.
 * - Si el backend envía valores no numéricos o negativos, se normalizan a 0.
 * - Convención: cuando `cantMaxPax <= 0`, se interpreta como "sin máximo" (pero para cálculo no suma extras).
 */
export function getReglaPaxRange(regla: ReglaTarifa): { min: number; max: number } {
  const min = Math.max(0, Number(regla.cantMinPax ?? 0) || 0);
  const max = Math.max(0, Number(regla.cantMaxPax ?? 0) || 0);
  return { min, max };
}

/**
 * Convierte un string horario `HH:mm` (o compatible) a minutos desde 00:00.
 * Retorna `null` si el formato es inválido o está fuera de rango.
 */
export function timeToMinutes(value: string): number | null {
  const v = (value || '').trim();
  if (!v) return null;
  const parts = v.split(':');
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Valida si la cantidad de adultos cae dentro del rango [min, max] de una regla.
 * Convención:
 * - Si `min` o `max` no son positivos, se consideran "sin límite" en ese extremo.
 */
export function matchAdultosEnRango(adultos: number, min: number, max: number): boolean {
  const minN = Number(min ?? 0) || 0;
  const maxN = Number(max ?? 0) || 0;
  if (minN > 0 && adultos < minN) return false;
  if (maxN > 0 && adultos > maxN) return false;
  return true;
}

/**
 * Calcula la cantidad de adultos "extra" que exceden el máximo permitido por la regla.
 * - Si `max <= 0` (sin máximo) => no se consideran extras.
 */
export function computeAdultosExtra(adultos: number, regla: ReglaTarifa): number {
  const { max } = getReglaPaxRange(regla);
  if (max <= 0) return 0;
  return Math.max(0, (Number(adultos ?? 0) || 0) - max);
}

/**
 * Evalúa si `horaMin` cae dentro del rango horario de una regla.
 * Convención: rango semiabierto [desde, hasta) para evitar solapamientos
 * (ej: 09:00 cae en la regla 09:00-10:00, no en 08:00-09:00).
 */
export function matchHoraEnRango(horaMin: number, desde: string, hasta: string): boolean {
  const start = timeToMinutes(desde);
  const end = timeToMinutes(hasta);
  if (start == null || end == null) return false;
  return horaMin >= start && horaMin < end;
}

/**
 * Selecciona la regla "más específica" entre varias candidatas.
 *
 * Criterios (de mayor prioridad a menor, implementados como sort):
 * 1) Menor ancho de rango de pax (más específico).
 * 2) Mayor cantMinPax y luego mayor cantMaxPax (prefiere rangos más altos si empatan).
 * 3) Menor ancho de rango horario (más específico).
 * 4) Más reciente `fechaRegistro`.
 * 5) Mayor `id` como desempate final.
 */
export function pickMostSpecificRegla(reglas: ReglaTarifa[]): ReglaTarifa | null {
  const sorted = [...(reglas ?? [])].sort((a, b) => {
    const aMin = Number(a.cantMinPax ?? 0) || 0;
    const aMax = Number(a.cantMaxPax ?? 0) || 0;
    const bMin = Number(b.cantMinPax ?? 0) || 0;
    const bMax = Number(b.cantMaxPax ?? 0) || 0;

    const aWidth = aMax > 0 && aMin > 0 ? aMax - aMin : Number.POSITIVE_INFINITY;
    const bWidth = bMax > 0 && bMin > 0 ? bMax - bMin : Number.POSITIVE_INFINITY;
    if (aWidth !== bWidth) return aWidth - bWidth;

    if (aMin !== bMin) return bMin - aMin;
    if (aMax !== bMax) return aMax - bMax;

    const aStart = timeToMinutes(a.horaInicio) ?? Number.POSITIVE_INFINITY;
    const aEnd = timeToMinutes(a.horaFin) ?? Number.POSITIVE_INFINITY;
    const bStart = timeToMinutes(b.horaInicio) ?? Number.POSITIVE_INFINITY;
    const bEnd = timeToMinutes(b.horaFin) ?? Number.POSITIVE_INFINITY;
    const aTimeWidth = Number.isFinite(aStart) && Number.isFinite(aEnd) ? aEnd - aStart : Number.POSITIVE_INFINITY;
    const bTimeWidth = Number.isFinite(bStart) && Number.isFinite(bEnd) ? bEnd - bStart : Number.POSITIVE_INFINITY;
    if (aTimeWidth !== bTimeWidth) return aTimeWidth - bTimeWidth;

    const aDate = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
    const bDate = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
    if (aDate !== bDate) return bDate - aDate;

    return (b.id ?? 0) - (a.id ?? 0);
  });

  return sorted[0] ?? null;
}

/**
 * Selecciona la mejor regla para una cantidad de adultos.
 * - Preferencia 1: reglas donde `adultos` está dentro del rango (min..max). Si `max<=0`, se considera "sin máximo".
 * - Preferencia 2: si ninguna regla contiene el valor, elige la regla con el `max` más alto (la más cercana por debajo),
 *   y usa `pickMostSpecificRegla` como desempate.
 *
 * Esto permite calcular pax extra cuando el usuario supera el máximo configurado de la regla elegida.
 */
export function pickReglaForAdultos(reglas: ReglaTarifa[], adultos: number): ReglaTarifa | null {
  const a = Number(adultos ?? 0) || 0;
  const inRange = (reglas ?? []).filter((r) => {
    const { min, max } = getReglaPaxRange(r);
    if (min > 0 && a < min) return false;
    if (max > 0 && a > max) return false;
    return true;
  });
  if (inRange.length) return pickMostSpecificRegla(inRange);

  const eligible = (reglas ?? []).filter((r) => {
    const { min } = getReglaPaxRange(r);
    return !(min > 0 && a < min);
  });
  if (!eligible.length) return null;

  const maxValue = Math.max(...eligible.map((r) => getReglaPaxRange(r).max || 0));
  const topMax = eligible.filter((r) => (getReglaPaxRange(r).max || 0) === maxValue);
  return pickMostSpecificRegla(topMax);
}

/**
 * Calcula el monto del servicio aplicando la regla seleccionada.
 *
 * Regla de cálculo:
 * - `precioBase` + (niños * `precioNino`) + (adultos extra * `precioAdultoExtra`)
 *
 * Donde:
 * - adultos extra = max(0, adultos - cantMaxPax)
 *   (si `cantMaxPax <= 0`, no se consideran extras).
 */
export function computeMontoServicio(options: { regla: ReglaTarifa; adultos: number; ninos: number }): number {
  const paxExtra = computeAdultosExtra(options.adultos, options.regla);
  return (
    (Number(options.regla.precioBase ?? 0) || 0) +
    (options.ninos * (Number(options.regla.precioNino ?? 0) || 0)) +
    (paxExtra * (Number(options.regla.precioAdultoExtra ?? 0) || 0))
  );
}
