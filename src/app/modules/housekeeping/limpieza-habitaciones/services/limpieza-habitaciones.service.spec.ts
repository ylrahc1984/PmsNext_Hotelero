import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LimpiezaHabitacionesService } from './limpieza-habitaciones.service';

describe('LimpiezaHabitacionesService', () => {
  let service: LimpiezaHabitacionesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LimpiezaHabitacionesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('initializes, loads with operational date and then lists rooms in order', () => {
    let result: any;
    service.prepararLista('01/08/2026', 'charly').subscribe((response) => (result = response));

    const initialize = httpMock.expectOne((request) =>
      request.url.endsWith('/frontdesk/limpiar-habitacion/inicializar')
      && request.params.get('operador') === 'charly'
    );
    expect(initialize.request.method).toBe('POST');
    initialize.flush('OK');

    const load = httpMock.expectOne((request) =>
      request.url.endsWith('/frontdesk/limpiar-habitacion/cargar')
      && request.params.get('fechaOpe') === '01/08/2026'
      && request.params.get('operador') === 'charly'
    );
    expect(load.request.method).toBe('POST');
    load.flush('OK');

    const list = httpMock.expectOne((request) =>
      request.url.endsWith('/frontdesk/limpiar-habitacion')
      && request.params.get('operador') === 'charly'
    );
    expect(list.request.method).toBe('GET');
    list.flush({
      respuesta: 'OK',
      habitaciones: [{
        room: '1',
        fechaIni: '07/31/2026 00:00:00',
        fechaFin: '08/02/2026',
        huesped: ' / Nuria Gonzales',
        numPax: 4,
        estado: 'OCUPADO',
        clean: null,
        grupo: 'STD',
        numChl: 0
      }]
    });

    expect(result.respuesta).toBe('OK');
    expect(result.habitaciones[0]).toEqual(jasmine.objectContaining({
      room: '1',
      fechaIni: '31/07/2026',
      fechaFin: '02/08/2026',
      huesped: 'Nuria Gonzales',
      estado: 'OCUPADO'
    }));
  });
});
