export const ROOM_CHARGE_VAT_RATE = 0.13;

export interface RoomChargeLineAmounts {
  subtotal: number;
  tax: number;
  total: number;
}

export function calculateRoomChargeLineAmounts(
  quantity: number,
  basePrice: number,
  vatRate = ROOM_CHARGE_VAT_RATE
): RoomChargeLineAmounts {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const safeBasePrice = Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  const safeVatRate = Number.isFinite(vatRate) && vatRate >= 0 ? vatRate : 0;
  const subtotal = round(safeQuantity * safeBasePrice);
  const tax = round(subtotal * safeVatRate);

  return {
    subtotal,
    tax,
    total: round(subtotal + tax)
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
