import { combinedTaxRate, roomPriceWithTax, storedRoomAmounts, taxWithinGrossAmount } from './reserva-hospedaje-tax.util';

describe('impuestos de hospedaje', () => {
  it('mantiene una tarifa que ya incluye IVA y separa su impuesto', () => {
    expect(roomPriceWithTax(113, 1, 0.13)).toBe(113);
    expect(taxWithinGrossAmount(226, 0.13)).toBe(26);
  });

  it('agrega una sola vez el impuesto a una tarifa que no lo incluye', () => {
    expect(roomPriceWithTax(100, 0, 0.13)).toBe(113);
    expect(taxWithinGrossAmount(113, 0.13)).toBe(13);
  });

  it('respeta configuraciones con tasa cero', () => {
    expect(roomPriceWithTax(100, 0, 0)).toBe(100);
    expect(taxWithinGrossAmount(100, 0)).toBe(0);
  });

  it('calcula IVA y servicio sobre la misma base', () => {
    const rate = combinedTaxRate([13, 10, 0]);
    expect(rate).toBe(0.23);
    expect(roomPriceWithTax(100, 0, rate)).toBe(123);
    expect(taxWithinGrossAmount(123, rate)).toBe(23);
    expect(storedRoomAmounts(100, 0, rate, 2, 3)).toEqual({ price: 123, total: 738, tax: 138 });
    expect(storedRoomAmounts(123, 1, rate, 1, 1)).toEqual({ price: 123, total: 123, tax: 23 });
  });

  it('rechaza tarifas sin una marca válida de impuesto incluido', () => {
    expect(() => roomPriceWithTax(100, 2, 0.13)).toThrowError();
  });
});
