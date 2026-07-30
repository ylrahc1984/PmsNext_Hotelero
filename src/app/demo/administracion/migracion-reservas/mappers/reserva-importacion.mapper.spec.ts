import { ReservaImportacion } from '../models/reserva-importacion.model';
import { ReservaImportacionMapper } from './reserva-importacion.mapper';

describe('ReservaImportacionMapper', () => {
  it('genera el contrato oficial sin usar el número externo como código PMS', () => {
    const reserva = {
      numeroExterno: 'EXT-1006',
      codAgencia: 'AGE',
      codTarifa: 'TAR',
      codPlan: 'SPL',
      estadoPms: 'CCR',
      directo: 'S',
      fechaEntrada: '2026-08-01',
      fechaSalida: '2026-08-03',
      fechaCreacion: '2026-07-30',
      fechaAnulada: '',
      noches: 2,
      nombre: 'James Wilson',
      nacionalidad: 'US',
      telefono: '5551234',
      moneda: 'USD',
      total: 200,
      detalleHabitaciones: [{
        catHabita: 'STD',
        tipHabita: 'DBL',
        cantHab: 2,
        precio: 50,
        moneda: 'USD',
        total: 200,
        cpl: 0,
        impuesto: 0,
        numPax: 4,
        numChild: 0,
        totChild: 0,
        cCosto: 'HOSPED',
        orden: 1
      }]
    } as ReservaImportacion;

    const request = ReservaImportacionMapper.toRequest(reserva);

    expect(request.codReserva).toBe('');
    expect(request.directo).toBe('S');
    expect(request.operador).toBe('CHANNEL');
    expect(request.habitaciones[0].precio).toBe(50);
    expect(request.inclusiones).toEqual([]);
    expect(request.servicios).toEqual([]);
    expect(request.observaciones).toContain('EXT-1006');
  });
});
