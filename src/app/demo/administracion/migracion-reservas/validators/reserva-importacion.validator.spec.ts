import { ReservaImportacion } from '../models/reserva-importacion.model';
import { ReservaImportacionValidator } from './reserva-importacion.validator';

describe('ReservaImportacionValidator', () => {
  it('acepta una reserva completamente homologada y distribuida', () => {
    const reserva = makeReservation();
    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]])
    });

    expect(reserva.estadoValidacion).toBe('VALIDA');
    expect(reserva.errores).toEqual([]);
  });

  it('bloquea diferencias de habitaciones, Pax y total', () => {
    const reserva = makeReservation();
    reserva.detalleHabitaciones[0].cantHab = 1;
    reserva.detalleHabitaciones[0].numPax = 1;
    reserva.detalleHabitaciones[0].total = 50;

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]])
    });

    expect(reserva.estadoValidacion).toBe('ERROR');
    expect(reserva.errores.some((message) => message.includes('habitaciones'))).toBeTrue();
    expect(reserva.errores.some((message) => message.includes('Pax distribuido'))).toBeTrue();
    expect(reserva.errores.some((message) => message.includes('total distribuido'))).toBeTrue();
  });
});

function makeReservation(): ReservaImportacion {
  return {
    id: '1',
    filaExcel: 2,
    numeroExterno: 'EXT-1',
    estadoOrigen: 'Co',
    tarifaOrigen: 'DIRECTOS',
    cplOrigen: '',
    nombre: 'Huésped',
    nacionalidad: 'CR',
    telefono: '88888888',
    fechaEntrada: '2026-08-01',
    fechaSalida: '2026-08-03',
    fechaCreacion: '2026-07-30',
    fechaAnulada: '',
    noches: 2,
    habitaciones: 2,
    pax: 4,
    total: 200,
    impuesto: 23,
    neto: 177,
    depositado: 0,
    pendiente: 200,
    codAgencia: 'AGE',
    codTarifa: 'TAR',
    codPlan: 'SPL',
    estadoPms: 'CCR',
    directo: 'S',
    moneda: 'USD',
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
    }],
    estadoValidacion: 'PENDIENTE',
    errores: [],
    advertencias: [],
    seleccionado: true,
    estadoImportacion: 'PENDIENTE'
  };
}

