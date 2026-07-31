import { RestaurantPrecheckPrintBuilder, RestaurantPrecheckPrintData } from './restaurant-precheck-print.builder';

describe('RestaurantPrecheckPrintBuilder', () => {
  it('prints and converts the final total instead of granTotal', () => {
    const builder = new RestaurantPrecheckPrintBuilder();
    const commands = builder.build(makePrintData()).join('');

    expect(commands).toContain('110.00 COL');
    expect(commands).toContain('0.22 USD');
  });
});

function makePrintData(): RestaurantPrecheckPrintData {
  return {
    empresa: { nombre: 'Restaurant' },
    puntoVenta: 'Restaurant',
    salon: 'Main',
    mesa: '1',
    mesero: 'Waiter',
    nota: {
      tipo: 'NP',
      serie: '001',
      numero: '1',
      fecha: '31/07/2026'
    },
    cuenta: 0,
    moneda: 'COL',
    tipoCambio: {
      monedaBase: 'COL',
      monedaReferencia: 'USD',
      compra: 500,
      venta: 520
    },
    detalles: [],
    totales: {
      subtotal: 80,
      subtotalneto: 80,
      impuestos: 20,
      total: 100,
      granTotal: 80
    },
    totalPropina: 10,
    impresoPor: 'Operator',
    fechaImpresion: new Date(2026, 6, 31)
  };
}
