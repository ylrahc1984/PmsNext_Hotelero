export interface FiscalConfig {
  pricesIncludeTax            : boolean;
  taxRate                     : number;
}

export const FISCAL_CONFIG: FiscalConfig = {
  // Configuracion local temporal. Luego se reemplazara por valores del backend.
  pricesIncludeTax: false,
  taxRate: 0.13
};

export function setFiscalPricesIncludeTax(value: boolean): void {
  FISCAL_CONFIG.pricesIncludeTax = !!value;
}

export function syncFiscalConfigFromEmpresaActivo(value: number | null | undefined): void {
  setFiscalPricesIncludeTax(Number(value) === 1);
}
