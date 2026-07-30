import { calculateHeaderNightlyPrice } from './reserva-price.util';

describe('calculateHeaderNightlyPrice', () => {
  it('usa el total completo para una habitación y una noche', () => {
    expect(calculateHeaderNightlyPrice(187.92, 1, 1)).toBe(187.92);
  });

  it('distribuye el total entre líneas y noches', () => {
    expect(calculateHeaderNightlyPrice(488.16, 2, 2)).toBe(122.04);
  });

  it('calcula el precio por noche de una estadía de tres noches', () => {
    expect(calculateHeaderNightlyPrice(210.09, 1, 3)).toBe(70.03);
  });

  it('rechaza divisores inválidos', () => {
    expect(calculateHeaderNightlyPrice(100, 0, 2)).toBeNull();
    expect(calculateHeaderNightlyPrice(100, 1, 0)).toBeNull();
  });
});
