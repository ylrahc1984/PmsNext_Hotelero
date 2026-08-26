import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environments/environment';
import { ReservaTagsService } from './reserva-tags.service';

describe('ReservaTagsService', () => {
  let service: ReservaTagsService;
  let httpMock: HttpTestingController;
  const baseUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ReservaTagsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searches only manual tags and encodes the search term as a query parameter', () => {
    service.buscarTags(' habi ', true).subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === `${baseUrl}/tags`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('busqueda')).toBe('habi');
    expect(request.request.params.get('soloManuales')).toBe('true');
    request.flush({ datos: [], respuesta: 'OK|BÚSQUEDA REALIZADA', exito: true, codigoHttp: 200 });
  });

  it('sends all selected tags in one batch request', () => {
    const payload = {
      tags: [
        { idTag: 1, observacion: 'VIP' },
        { idTag: 10, observacion: null }
      ]
    };

    service.guardarTagsBatch('EE260000290', payload).subscribe();

    const request = httpMock.expectOne(`${baseUrl}/EE260000290/tags/batch`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      datos: [],
      tagsRecibidos: 2,
      tagsInsertados: 2,
      respuesta: 'OK|TAGS PROCESADOS CORRECTAMENTE',
      exito: true,
      codigoHttp: 200
    });
  });

  it('loads the active tags assigned to an existing reservation', () => {
    service.obtenerTagsReserva('EE260000290').subscribe();

    const request = httpMock.expectOne(`${baseUrl}/EE260000290/tags`);
    expect(request.request.method).toBe('GET');
    request.flush({ datos: [], respuesta: 'OK|TAGS ACTIVOS CONSULTADOS', exito: true, codigoHttp: 200 });
  });

  it('encodes the removal reason with HttpParams', () => {
    service.retirarTag('EE260000290', 1, 'Ya no se utilizará').subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === `${baseUrl}/EE260000290/tags/1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('motivoRetiro')).toBe('Ya no se utilizará');
    request.flush({ datos: null, respuesta: 'OK|TAG RETIRADO CORRECTAMENTE', exito: true, codigoHttp: 200 });
  });
});
