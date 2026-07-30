import { ExcelReservasReaderService } from './excel-reservas-reader.service';

describe('ExcelReservasReaderService reservas_alt', () => {
  const service = new ExcelReservasReaderService();
  const headers = [
    'id rese', 'nro reserva', 'fecha ent', 'fecha sal', 'fecha reserv', 'nombre',
    'nombre reserv', 'cant habi', 'pax', 'Total', 'Prepagado', 'id mone', 'cod mone',
    'desc mone', 'noches', 'id estado', 'estado', 'id cont', 'contrato', 'id origen',
    'origen', 'observaciones', 'telef reserv', 'email', 'id online', 'id naci', 'desc nac',
    'id thab', 'tipo hab', 'desc t hab', 'id habi', 'habitacion', 'max adultos', 'max ninos',
    'tar cred', 'fecha exp TC'
  ];

  it('rechaza el archivo cuando faltan columnas críticas', () => {
    expect(() => service.parseReservasAltMatrix([['id rese', 'nombre'], ['1', 'Huésped']]))
      .toThrowError(/formato esperado|Columnas faltantes/);
  });

  it('produce una reserva y una habitación para una fila', () => {
    const result = service.parseReservasAltMatrix([
      headers,
      row({ id: '73520', number: '961', rooms: 1, pax: 2, reservationDate: '20/07/2026 14:35:12' })
    ]);

    expect(result.reservas.length).toBe(1);
    expect(result.reservas[0].detalleHabitaciones.length).toBe(1);
    expect(result.reservas[0].idReservaOrigen).toBe('73520');
    expect(result.reservas[0].fechaCreacion).toBe('2026-07-20T14:35:12');
  });

  it('agrupa cuatro filas por id rese sin sumar Total, Prepagado, Pax ni cant habi', () => {
    const rows = [1, 2, 3, 4].map((roomNumber) =>
      row({
        id: '73521',
        number: '962',
        rooms: 4,
        pax: 8,
        total: 603.99,
        prepaid: 300,
        roomNumber: `0${roomNumber}`,
        maxAdults: 2
      })
    );
    const result = service.parseReservasAltMatrix([headers, ...rows]);
    const reservation = result.reservas[0];

    expect(result.reservas.length).toBe(1);
    expect(reservation.detalleHabitaciones.length).toBe(4);
    expect(reservation.total).toBe(603.99);
    expect(reservation.depositado).toBe(300);
    expect(reservation.pax).toBe(8);
    expect(reservation.habitaciones).toBe(4);
    expect(reservation.detalleHabitaciones.reduce((sum, room) => sum + room.numPax, 0)).toBe(8);
  });

  it('marca inconsistencias de Total y fechas entre filas del mismo id rese', () => {
    const first = row({ id: '73521', number: '962', rooms: 2, pax: 4, total: 600, maxAdults: 2 });
    const second = row({ id: '73521', number: '962', rooms: 2, pax: 4, total: 650, maxAdults: 2 });
    second[headers.indexOf('fecha sal')] = '04/08/2026';

    const reservation = service.parseReservasAltMatrix([headers, first, second]).reservas[0];

    expect(reservation.parserErrores.some((message) => message.includes('Total'))).toBeTrue();
    expect(reservation.parserErrores.some((message) => message.includes('fecha de salida'))).toBeTrue();
  });

  it('conserva una distribución revisable si max adultos no suma el Pax de cabecera', () => {
    const reservation = service.parseReservasAltMatrix([
      headers,
      row({ id: '73521', number: '962', rooms: 2, pax: 5, maxAdults: 2 }),
      row({ id: '73521', number: '962', rooms: 2, pax: 5, maxAdults: 2 })
    ]).reservas[0];

    expect(reservation.pax).toBe(5);
    expect(reservation.detalleHabitaciones.reduce((sum, room) => sum + room.numPax, 0)).toBe(4);
  });

  it('ignora completamente datos de tarjeta', () => {
    const source = row({ id: '73520', number: '961', rooms: 1, pax: 2 });
    source[headers.indexOf('tar cred')] = '4111111111111111';
    source[headers.indexOf('fecha exp TC')] = '12/30';

    const reservation = service.parseReservasAltMatrix([headers, source]).reservas[0];

    expect(JSON.stringify(reservation)).not.toContain('4111111111111111');
    expect(JSON.stringify(reservation)).not.toContain('12/30');
  });

  function row(options: {
    id: string;
    number: string;
    rooms: number;
    pax: number;
    total?: number;
    prepaid?: number;
    roomNumber?: string;
    maxAdults?: number;
    reservationDate?: string;
  }): unknown[] {
    const values: Record<string, unknown> = {
      'id rese': options.id,
      'nro reserva': options.number,
      'fecha ent': '01/08/2026',
      'fecha sal': '03/08/2026',
      'fecha reserv': options.reservationDate ?? '20/07/2026',
      nombre: 'ANGELA REVERT',
      'nombre reserv': 'ANGELA REVERT',
      'cant habi': options.rooms,
      pax: options.pax,
      Total: options.total ?? 200,
      Prepagado: options.prepaid ?? 0,
      'id mone': 1,
      'cod mone': 'USD',
      'desc mone': 'Dólar',
      noches: 2,
      'id estado': 2,
      estado: 'Confirmada',
      'id cont': 10,
      contrato: 'BOOKING',
      'id origen': 3,
      origen: 'ONLINE',
      observaciones: 'Llegada tarde',
      'telef reserv': '8888-9999',
      email: 'guest@example.com',
      'id online': 'OTA-1',
      'id naci': 1,
      'desc nac': 'Costa Rica',
      'id thab': 5,
      'tipo hab': 'LC',
      'desc t hab': 'Love Cove',
      'id habi': options.roomNumber ?? '01',
      habitacion: options.roomNumber ?? '01',
      'max adultos': options.maxAdults ?? options.pax,
      'max ninos': 1
    };
    return headers.map((header) => values[header] ?? null);
  }
});
