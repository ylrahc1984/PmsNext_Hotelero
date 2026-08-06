import { EstadoLimpiezaVisual, LimpiezaHabitacionValor } from './limpieza-habitacion.model';

export function resolveEstadoLimpieza(value: LimpiezaHabitacionValor | unknown): EstadoLimpiezaVisual {
  if (value === true || Number(value) === 1) return 'LIMPIA';

  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (['L', 'LIMPIA', 'LIMPIO', 'CLEAN', 'SI', 'TRUE'].includes(normalized)) return 'LIMPIA';
  if (['EN PROCESO', 'PROCESO', 'P'].includes(normalized)) return 'EN PROCESO';
  if (['INSPECCION', 'INSPECCIÓN', 'I'].includes(normalized)) return 'INSPECCION';
  return 'PENDIENTE';
}
