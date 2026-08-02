import { calculateRoomChargeLineAmounts, ROOM_CHARGE_VAT_RATE } from './room-charge-calculation.util';

describe('calculateRoomChargeLineAmounts', () => {
  it('calculates subtotal, fixed 13 percent VAT and total', () => {
    expect(ROOM_CHARGE_VAT_RATE).toBe(0.13);
    expect(calculateRoomChargeLineAmounts(2, 10)).toEqual({
      subtotal: 20,
      tax: 2.6,
      total: 22.6
    });
  });

  it('rounds monetary values to two decimal places', () => {
    expect(calculateRoomChargeLineAmounts(3, 10.99)).toEqual({
      subtotal: 32.97,
      tax: 4.29,
      total: 37.26
    });
  });
});
