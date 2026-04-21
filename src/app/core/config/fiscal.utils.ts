export interface FiscalCalculationOptions {
  pricesIncludeTax: boolean;
  taxRate: number;
  redondeoDecimales?: number;
}

const DEFAULT_FISCAL_CALCULATION_OPTIONS: Required<FiscalCalculationOptions> = {
  pricesIncludeTax: false,
  taxRate: 0,
  redondeoDecimales: 2
};

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function normalizeFiscalDirecto(value: string): '0' | '1' {
  return (value || '').toString().trim() === '1' ? '1' : '0';
}

export function roundCurrency(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const normalized = toNumber(value);
  return Math.round((normalized + Number.EPSILON) * factor) / factor;
}

export function getFiscalCalculationOptions(options?: Partial<FiscalCalculationOptions>): Required<FiscalCalculationOptions> {
  return {
    ...DEFAULT_FISCAL_CALCULATION_OPTIONS,
    ...(options ?? {})
  };
}

export function calculateTaxFromNetAmount(
  netAmount: number,
  directo: string,
  options?: Partial<FiscalCalculationOptions>
): { neto: number; iva: number; total: number } {
  const settings = getFiscalCalculationOptions(options);
  const neto = roundCurrency(netAmount, settings.redondeoDecimales);

  if (normalizeFiscalDirecto(directo) === '1') {
    return { neto, iva: 0, total: neto };
  }

  const iva = roundCurrency(neto * settings.taxRate, settings.redondeoDecimales);
  return {
    neto,
    iva,
    total: roundCurrency(neto + iva, settings.redondeoDecimales)
  };
}

export function splitTaxInclusiveAmount(
  configuredAmount: number,
  directo: string,
  options?: Partial<FiscalCalculationOptions>
): { neto: number; iva: number; total: number } {
  const settings = getFiscalCalculationOptions(options);
  const amount = roundCurrency(configuredAmount, settings.redondeoDecimales);

  if (!settings.pricesIncludeTax || !settings.taxRate) {
    return calculateTaxFromNetAmount(amount, directo, settings);
  }

  const divisor = 1 + settings.taxRate;
  const neto = roundCurrency(amount / divisor, settings.redondeoDecimales);
  return calculateTaxFromNetAmount(neto, directo, settings);
}

export function calculateFiscalTotals(
  subtotal: number,
  descuento: number,
  directo: string,
  options?: Partial<FiscalCalculationOptions>
): { subtotal: number; descuento: number; neto: number; iva: number; total: number } {
  const settings = getFiscalCalculationOptions(options);
  const safeSubtotal = roundCurrency(subtotal, settings.redondeoDecimales);
  const safeDescuento = roundCurrency(Math.min(Math.max(0, descuento), safeSubtotal), settings.redondeoDecimales);
  const subtotalConDescuento = roundCurrency(Math.max(0, safeSubtotal - safeDescuento), settings.redondeoDecimales);

  const fiscalSplit = settings.pricesIncludeTax
    ? splitTaxInclusiveAmount(subtotalConDescuento, directo, settings)
    : calculateTaxFromNetAmount(subtotalConDescuento, directo, settings);

  return {
    subtotal: safeSubtotal,
    descuento: safeDescuento,
    neto: fiscalSplit.neto,
    iva: fiscalSplit.iva,
    total: fiscalSplit.total
  };
}
