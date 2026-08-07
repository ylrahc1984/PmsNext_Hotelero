import { mapReservaCompletaToHospedajeDetalle } from './reserva-hospedaje-detalle.mapper';
import { ReservaCompletaDto } from './reserva-hospedaje-detalle.model';

describe('mapReservaCompletaToHospedajeDetalle', () => {
  it('adapta la firma de reserva completa sin depender del modelo compartido de edicion', () => {
    const response: ReservaCompletaDto = {
      encabezado: {
        prV01_CodReserva: 'NA260000320',
        prV01_CodAgencia: '02051',
        mR01_NomAgencia: 'DIRECTOS',
        prV01_FecIngresa: '2026-08-07T00:00:00',
        prV01_FecSalida: '2026-08-08T00:00:00',
        prV01_FecConfirma: '1900-01-01T00:00:00',
        prV01_Moneda: 'USD',
        prV01_Directo: 1
      },
      detalleHabitaciones: [
        {
          prV02_CatHabita: 'FUNGA',
          prV02_TipHabita: 'DOUBL',
          prV02_CantHab: 1,
          prV02_NumPax: 2
        }
      ],
      serviciosIncluidos: [
        {
          prV03_CodServ: '00001',
          prV03_DesServ: 'DESAYUNO INCLUIDO',
          prV03_Cantidad: 2
        }
      ],
      serviciosAdicionales: [
        {
          prV04_CodSrv: 'TRASLADO',
          prV04_Descripcion: 'Traslado aeropuerto',
          prV04_Cantidad: 2,
          prV04_Precio: 25
        }
      ],
      desgloseHabitaciones: [
        {
          prV06_NumHabita: '1',
          prV06_HabOrigen: 'HB0001',
          prV06_CatHabita: 'FUNGA',
          prV06_TipHabita: 'DOUBL',
          prV06_FechaIng: '2026-08-07T00:00:00',
          prV06_FechaSal: '2026-08-08T00:00:00',
          prV06_NumPax: 2
        }
      ]
    };

    const detalle = mapReservaCompletaToHospedajeDetalle(response);

    expect(detalle.codReserva).toBe('NA260000320');
    expect(detalle.fecIngreso).toBe('07/08/2026');
    expect(detalle.fecConfirma).toBe('');
    expect(detalle.directo).toBeTrue();
    expect(detalle.habitaciones[0].catHabita).toBe('FUNGA');
    expect(detalle.inclusiones[0].codServ).toBe('00001');
    expect(detalle.servicios[0].total).toBe(50);
    expect(detalle.desgloseHabitaciones[0]).toEqual(
      jasmine.objectContaining({ numHabita: '1', habOrigen: 'HB0001', fechaIngreso: '07/08/2026' })
    );
  });

  it('normaliza secciones ausentes como arreglos vacios', () => {
    const detalle = mapReservaCompletaToHospedajeDetalle({ encabezado: null });

    expect(detalle.habitaciones).toEqual([]);
    expect(detalle.inclusiones).toEqual([]);
    expect(detalle.servicios).toEqual([]);
    expect(detalle.desgloseHabitaciones).toEqual([]);
  });
});
