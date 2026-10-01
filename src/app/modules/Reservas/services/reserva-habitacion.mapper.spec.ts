import { ReservaHabitacionMapper, ReservaHabitacionFormValue } from './reserva-habitacion.mapper';

describe('ReservaHabitacionMapper', () => {
  it('envía importes brutos e indicador incluido en las tres colecciones', () => {
    const value: ReservaHabitacionFormValue = {
      codReserva: 'R1', codAgencia: '', codTarifa: 'T1', codPlan: 'DES',
      fecIngreso: '2026-09-30', fecSalida: '2026-10-01', fecCreacion: '2026-09-30',
      fecConfirma: '', fecPrepago: '', fecAnulada: '', totNoches: 1, totDias: 2,
      descripcion: '', tCambio: 1, folio: '', estado: 'ABI', moneda: 'CRC',
      totalRsv: 246, observaciones: '', procesa: '0', directo: false, esCpl: false,
      operador: '',
      habitaciones: [{ categoria: 'CAT', tipo: 'TIP', cantidad: 1, precio: 123,
        cantidadNinos: 0, precioNino: 0, total: 123, impuesto: 23, cCosto: 'HOSPED' }],
      inclusiones: [{ codServ: 'DES', desServ: 'Desayuno', tipPax: 'A', precio: 50,
        cantidad: 1, totServ: 50, cCosto: 'ALIM' }],
      servicios: [{ codSrv: 'S1', descripcion: 'Servicio', cantidad: 1, precio: 60,
        total: 73, impuesto: 13, tipPax: 'Reserva', cCosto: 'SERV' }]
    };

    const request = ReservaHabitacionMapper.toRequest(value, 246);

    expect(request.totalRsv).toBe(246);
    expect(request.habitaciones[0]).toEqual(jasmine.objectContaining({ total: 123, impuesto: 1, cCosto: 'HOSPED' }));
    expect(request.inclusiones[0]).toEqual(jasmine.objectContaining({ totServ: 50, impInc: 1, cCosto: 'ALIM' }));
    expect(request.servicios[0]).toEqual(jasmine.objectContaining({ total: 73, impuesto: 1, cCosto: 'SERV' }));
  });
});
