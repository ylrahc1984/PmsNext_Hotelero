import { TipoPax } from './detalle-lista-precio-v2.models';

export const normalizeTipoPax = (value: unknown): TipoPax => {
  const normalized = `${value ?? ''}`.trim().toUpperCase();
  if (normalized === 'CHL') {
    return 'CHL';
  }
  if (normalized === 'NAC') {
    return 'NAC';
  }
  return 'PAx';
};

export const toBackendTipoPax = (value: TipoPax): string => {
  return value === 'PAx' ? 'PAX' : value;
};
