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
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[4, new Set(['DBL'])]])]])
    });

    expect(reserva.estadoValidacion).toBe('VALIDA');
    expect(reserva.errores).toEqual([]);
  });

  it('bloquea diferencias de habitaciones/Pax y advierte diferencia financiera', () => {
    const reserva = makeReservation();
    reserva.detalleHabitaciones[0].cantHab = 1;
    reserva.detalleHabitaciones[0].numPax = 1;
    reserva.detalleHabitaciones[0].precio = 25;
    reserva.detalleHabitaciones[0].total = 50;

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[4, new Set(['DBL'])]])]])
    });

    expect(reserva.estadoValidacion).toBe('ERROR');
    expect(reserva.errores.some((message) => message.includes('habitaciones'))).toBeTrue();
    expect(reserva.errores.some((message) => message.includes('Pax de las líneas'))).toBeTrue();
    expect(reserva.advertencias.some((message) => message.includes('Los detalles suman'))).toBeTrue();
  });

  it('bloquea una categoría que no tiene tipo configurado para el Pax', () => {
    const reserva = makeReservation();
    reserva.detalleHabitaciones[0].numPax = 3;
    reserva.pax = 3;

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[2, new Set(['DBL'])]])]])
    });

    expect(reserva.estadoValidacion).toBe('ERROR');
    expect(reserva.errores.some((message) => message.includes('con 3 Pax'))).toBeTrue();
  });

  it('bloquea una categoría ausente en el archivo y sin homologación manual', () => {
    const reserva = makeReservation();
    reserva.detalleHabitaciones[0].categoriaOrigen = '';
    reserva.detalleHabitaciones[0].catHabita = '';
    reserva.detalleHabitaciones[0].tipHabita = '';

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[4, new Set(['DBL'])]])]])
    });

    expect(reserva.estadoValidacion).toBe('ERROR');
    expect(reserva.errores.some((message) => message.includes('Categoría no especificada'))).toBeTrue();
  });

  it('advierte prepago y total cero sin intentar migrar el prepago', () => {
    const reserva = makeReservation();
    reserva.total = 0;
    reserva.depositado = 100;
    reserva.detalleHabitaciones[0].precio = 0;
    reserva.detalleHabitaciones[0].total = 0;

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[4, new Set(['DBL'])]])]])
    });

    expect(reserva.advertencias.some((message) => message.includes('prepago'))).toBeTrue();
    expect(reserva.advertencias.some((message) => message.includes('importe total 0'))).toBeTrue();
  });

  it('bloquea una reserva con importe cuando no existe precio de habitación', () => {
    const reserva = makeReservation();
    reserva.detalleHabitaciones[0].precio = 0;
    reserva.detalleHabitaciones[0].total = 0;

    ReservaImportacionValidator.validate(reserva, {
      agencias: new Set(['AGE']),
      tarifas: new Set(['TAR']),
      planes: new Set(['SPL']),
      categorias: new Set(['STD']),
      tiposPorCategoria: new Map([['STD', new Set(['DBL'])]]),
      tiposPorCategoriaYPax: new Map([['STD', new Map([[4, new Set(['DBL'])]])]])
    });

    expect(reserva.estadoValidacion).toBe('ERROR');
    expect(reserva.errores.some((message) => message.includes('Precio de habitación pendiente'))).toBeTrue();
  });
});

function makeReservation(): ReservaImportacion {
  return {
    id: '1',
    idReservaOrigen: '73521',
    filaExcel: 2,
    filasExcel: [2],
    numeroExterno: 'EXT-1',
    estadoOrigen: 'Co',
    idEstadoOrigen: '2',
    tarifaOrigen: 'DIRECTOS',
    idContratoOrigen: '10',
    contratoOrigen: 'DIRECTOS',
    idOrigen: '1',
    origen: 'DIRECTO',
    cplOrigen: '',
    nombre: 'Huésped',
    nombreReservante: 'Huésped',
    nacionalidad: 'CR',
    telefono: '88888888',
    email: 'guest@example.com',
    otaId: 'OTA-1',
    comentarios: '',
    referencia: '',
    idNacionalidadOrigen: '1',
    vip: '',
    fechaEntrada: '2026-08-01',
    fechaSalida: '2026-08-03',
    fechaCreacion: '2026-07-30',
    fechaAnulada: '',
    noches: 2,
    nochesOrigen: 2,
    habitaciones: 2,
    lineasHabitacion: 1,
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
    idMonedaOrigen: '1',
    monedaOrigen: 'USD',
    descripcionMonedaOrigen: 'Dólar',
    moneda: 'USD',
    tipoCambio: 1,
    detalleHabitaciones: [{
      habitacionOrigen: '01',
      categoriaOrigen: 'STD',
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
      , errores: [],
      advertencias: []
    }],
    parserErrores: [],
    parserAdvertencias: [],
    estadoValidacion: 'PENDIENTE',
    errores: [],
    advertencias: [],
    seleccionado: true,
    estadoImportacion: 'PENDIENTE'
  };
}
