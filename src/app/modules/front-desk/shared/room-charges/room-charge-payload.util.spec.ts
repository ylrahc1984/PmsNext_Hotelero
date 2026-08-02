import { MutableRoomChargeHeader, MutableRoomChargeLine } from './room-charge-mutation.model';
import { buildRoomChargeUpdatePayload } from './room-charge-payload.util';

describe('buildRoomChargeUpdatePayload', () => {
  const header: MutableRoomChargeHeader = {
    tipCrgHab: 'CHB',
    numCrgHab: '000123',
    codReserva: 'RSV-1',
    numHab: 'FM-10',
    pntVenta: 'PF',
    fecha: '2/08/2026',
    hora: '9:05:00',
    numDocu: 'DOC-1',
    nombrePax: 'Huésped',
    moneda: 'usd',
    cierre: '0',
    numCierre: '0'
  };

  const line: MutableRoomChargeLine = {
    codRsv: 'RSV-1',
    numHab: 'FM-10',
    pntVenta: 'PF',
    fecha: '02/08/2026',
    hora: '9:05',
    grupo: 'ALI',
    categoria: 'REST',
    codConsumo: 'P01',
    nomConsumo: 'Desayuno',
    cantidad: 2,
    precio: 12.5,
    total: 25,
    moneda: 'USD',
    tipNPedido: '',
    numNPedido: '',
    codMozo: '',
    incluido: 'S',
    exonerado: '0',
    orden: 1,
    comentario: ''
  };

  it('builds the same normalized update contract for room stays and master folios', () => {
    const payload = buildRoomChargeUpdatePayload(header, [line], 'OPERADOR');

    expect(payload).toEqual(jasmine.objectContaining({
      proceso: 2,
      numCrgHab: '000123',
      fecha: '02/08/2026',
      hora: '09:05',
      mtoTotal: 25,
      moneda: 'USD',
      operador: 'OPERADOR'
    }));
    expect(payload?.detalle[0]).toEqual(jasmine.objectContaining({
      fecha: '02/08/2026',
      hora: '09:05',
      incluido: 1,
      total: 25,
      operador: 'OPERADOR'
    }));
  });

  it('rejects an empty detail or incomplete financial identity', () => {
    expect(buildRoomChargeUpdatePayload(header, [], 'OPERADOR')).toBeNull();
    expect(buildRoomChargeUpdatePayload({ ...header, pntVenta: '' }, [line], 'OPERADOR')).toBeNull();
  });

  it('never serializes object values as [object Object] in SQL scalar fields', () => {
    const unsafeLine = {
      ...line,
      tipNPedido: { value: 'PED' },
      numNPedido: { value: '100' }
    } as unknown as MutableRoomChargeLine;

    const payload = buildRoomChargeUpdatePayload(header, [unsafeLine], 'OPERADOR');

    expect(payload?.detalle[0].tipNPedido).toBe('');
    expect(payload?.detalle[0].numNPedido).toBe('');
    expect(JSON.stringify(payload)).not.toContain('[object Object]');
  });

  it('limits TipNPedido to the three characters accepted by the backend contract', () => {
    const payload = buildRoomChargeUpdatePayload(header, [{ ...line, tipNPedido: 'PEDIDO' }], 'OPERADOR');
    expect(payload?.detalle[0].tipNPedido).toBe('PED');
  });
});
