function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function combinedTaxRate(percentages: number[]): number {
  if (!percentages.length || percentages.some((percentage) => !Number.isFinite(percentage) || percentage < 0)) {
    throw new Error('La configuración de impuestos del centro de costo no es válida.');
  }

  // Todos los porcentajes gravan la misma base; no se aplican impuestos sobre impuestos.
  return percentages.reduce((sum, percentage) => sum + percentage, 0) / 100;
}

export function roomPriceWithTax(price: number, taxIncluded: number, taxRate: number): number {
  if (taxIncluded !== 0 && taxIncluded !== 1) {
    throw new Error('La tarifa de hospedaje no indica si incluye impuestos.');
  }

  return taxIncluded === 1 ? price : roundMoney(price * (1 + taxRate));
}

export function taxWithinGrossAmount(grossAmount: number, taxRate: number): number {
  return taxRate > 0 ? roundMoney(grossAmount - grossAmount / (1 + taxRate)) : 0;
}

export function storedRoomAmounts(
  tariffPrice: number,
  taxIncluded: number,
  taxRate: number,
  roomQuantity: number,
  nights: number,
  childQuantity = 0,
  childPrice = 0
): { price: number; total: number; tax: number } {
  const price = roomPriceWithTax(tariffPrice, taxIncluded, taxRate);
  const total = roundMoney((roomQuantity * price + childQuantity * childPrice) * nights);
  return { price, total, tax: taxWithinGrossAmount(total, taxRate) };
}
