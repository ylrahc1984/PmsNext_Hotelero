import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environments/environment';
import { ReservaTagResumen } from '../models/reserva-tag.model';
import { ReservaHabitacionService } from './reserva-habitacion.service';

describe('ReservaHabitacionService embedded reservation tags', () => {
  let service: ReservaHabitacionService;
  let httpMock: HttpTestingController;
  const listUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas-habitacion`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReservaHabitacionService]
    });
    service = TestBed.inject(ReservaHabitacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consulta por creación con proceso 93 y conserva fechas, filtros y paginación', () => {
    let creacion: string | undefined;
    service.consultarReservas({
      tipoFecha: 'creacion', fecIngreso: '2026-09-28', fecSalida: '2026-09-28',
      pagina: 2, tamanoPagina: 15, agencia: ' AG01 ', estado: 'CCR'
    }).subscribe((page) => creacion = page.reservas[0].creacion);

    const request = httpMock.expectOne((candidate) => candidate.url === `${listUrl}/por-fecha-creacion`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('Proceso')).toBe('93');
    expect(request.request.params.get('FecIngreso')).toBe('28/09/2026');
    expect(request.request.params.get('FecSalida')).toBe('28/09/2026');
    expect(request.request.params.get('Pagina')).toBe('2');
    expect(request.request.params.get('TamanoPagina')).toBe('15');
    expect(request.request.params.get('CodAgencia')).toBe('AG01');
    expect(request.request.params.get('Estado')).toBe('CCR');
    request.flush({ reservas: [{ codReserva: 'RS26000001', fecCreacion: '2026-09-28' }] });
    expect(creacion).toBe('28/09/2026');
  });

  it('normalizes embedded tags and alert metadata from the single paginated response', () => {
    let resultTags: ReservaTagResumen[] = [];
    let hasAlerts = false;
    service.consultarReservas({
      fecIngreso: '24/08/2026',
      fecSalida: '26/08/2026',
      pagina: 1,
      tamanoPagina: 10
    }).subscribe((page) => {
      resultTags = page.reservas[0]?.tags ?? [];
      hasAlerts = page.reservas[0]?.tieneAlertas ?? false;
    });

    const request = httpMock.expectOne((candidate) => candidate.url === listUrl);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('Proceso')).toBe('90');
    request.flush({
      reservas: [{
        codReserva: 'EE260000357',
        descripcion: 'Reserva con tags',
        tags: [makeTag(1, 'VIP'), makeTag(2, 'Alergia', true)],
        cantidadTags: 2,
        tieneAlertas: true
      }],
      totalRegistros: 1,
      paginaActual: 1,
      tamanoPagina: 10,
      totalPaginas: 1
    });

    expect(resultTags.map((tag) => tag.idTag)).toEqual([1, 2]);
    expect(hasAlerts).toBeTrue();
    httpMock.expectNone((candidate) => /\/reservas\/[^/]+\/tags$/.test(candidate.url));
  });

  it('normalizes missing or null embedded collections to an empty array', () => {
    const collected: number[] = [];
    service.consultarReservas({
      fecIngreso: '24/08/2026',
      fecSalida: '26/08/2026',
      pagina: 1,
      tamanoPagina: 10
    }).subscribe((page) => page.reservas.forEach((reserva) => collected.push(reserva.tags.length)));

    httpMock.expectOne((candidate) => candidate.url === listUrl).flush({
      reservas: [{ codReserva: 'A', tags: null }, { codReserva: 'B' }],
      totalRegistros: 2,
      paginaActual: 1,
      tamanoPagina: 10,
      totalPaginas: 1
    });

    expect(collected).toEqual([0, 0]);
  });
});

function makeTag(idTag: number, nombre: string, esAlerta = false): ReservaTagResumen {
  return {
    idTag,
    idCategoria: 1,
    categoria: 'Experiencia',
    ordenCategoria: 10,
    nombre,
    descripcion: null,
    color: '#DBEAFE',
    icono: 'tag',
    prioridad: esAlerta ? 3 : 1,
    esAlerta
  };
}
