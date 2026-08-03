import { RoomChargePosPrintBuilder, RoomChargePosPrintData } from './room-charge-pos-print.builder';

describe('RoomChargePosPrintBuilder', () => {
  it('omite los precios del detalle para desayuno incluido', () => {
    const receipt = new RoomChargePosPrintBuilder().build(makePrintData('CIN')).join('');

    expect(receipt).toContain('Cantidad');
    expect(receipt).toContain('Descripcion');
    expect(receipt).toContain('2 x Desayuno continental');
    expect(receipt).not.toContain('Precio');
    expect(receipt).not.toContain('12.50 USD');
  });

  it('mantiene los precios del detalle para cargos normales de habitación', () => {
    const receipt = new RoomChargePosPrintBuilder().build(makePrintData('CH')).join('');

    expect(receipt).toContain('Precio');
    expect(receipt).toContain('2 x Desayuno continental');
    expect(receipt).toContain('12.50 USD');
  });
});

function makePrintData(operationType: 'CIN' | 'CH'): RoomChargePosPrintData {
  return {
    empresa: { nombre: 'Hotel' },
    encabezado: {
      tipCrgHab: operationType,
      numCrgHab: '1',
      codReserva: 'RS-1',
      numHab: '101',
      pntVenta: 'REST',
      fecha: '03/08/2026',
      hora: '08:00',
      numDocu: 'RS-1',
      nombrePax: 'Huésped',
      mtoTot: 25,
      moneda: 'USD',
      cierre: '0',
      numCierre: '0',
      estado: '0',
      operador: 'ADMIN'
    },
    detalles: [{
      tipCrgHab: operationType,
      numCrgHab: '1',
      codRsv: 'RS-1',
      numHab: '101',
      pntVenta: 'REST',
      fecha: '03/08/2026',
      hora: '08:00',
      grupo: '',
      categoria: '',
      codConsumo: 'DES-1',
      nomConsumo: 'Desayuno continental',
      cantidad: 2,
      precio: 6.25,
      total: 12.5,
      moneda: 'USD',
      tipNPedido: 'NP',
      numNPedido: '1',
      codMozo: '01',
      incluido: operationType.startsWith('CI') ? 'S' : 'N',
      exonerado: 'N',
      orden: 1,
      estado: '0',
      comentario: '',
      porDescuento: 0,
      descuento: 0,
      precioLista: 6.25,
      operador: 'ADMIN'
    }],
    puntoVentaNombre: 'Restaurante',
    tipoDocumento: 'ORIGINAL',
    fechaImpresion: new Date(2026, 7, 3, 8, 0)
  };
}
