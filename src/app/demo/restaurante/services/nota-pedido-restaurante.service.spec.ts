import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotaPedidoRestauranteService } from './nota-pedido-restaurante.service';

describe('NotaPedidoRestauranteService', () => {
  let service: NotaPedidoRestauranteService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(NotaPedidoRestauranteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('updates the order comment using the required fixed room and item values', () => {
    const payload = {
      proceso: 1,
      tipNP: 'RR',
      serieNP: '001',
      numNP: '0000020803',
      nRoom: '101',
      comentario: 'HOLA MUNDO',
      nItem: 0,
      respuesta: ''
    };

    service.actualizarComentarios(payload).subscribe((response) => {
      expect(response.datos?.numNP).toBe('0000020803');
    });

    const request = httpMock.expectOne((candidate) => candidate.url.endsWith('/comentarios-nota-pedido'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({
      mensaje: 'Comentarios actualizados correctamente',
      datos: { tipNP: 'RR', serieNP: '001', numNP: '0000020803' }
    });
  });

  it('loads the comment using the active order reference', () => {
    service.obtenerComentarios({ tipNP: 'RR', serieNP: '001', numNP: '0000020803' }).subscribe((response) => {
      expect(response.datos?.comentario).toBe('mesa de prueba');
    });

    const request = httpMock.expectOne((candidate) =>
      candidate.url.endsWith('/comentarios-nota-pedido') &&
      candidate.params.get('tipNP') === 'RR' &&
      candidate.params.get('serieNP') === '001' &&
      candidate.params.get('numNP') === '0000020803'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      mensaje: 'Consulta exitosa',
      datos: { comentario: 'mesa de prueba', nRoom: '101', items: 0 }
    });
  });

  it('sends the required annulment reason in comentario when deleting an item', () => {
    service.eliminarItem({
      tipNp: 'RR',
      serieNp: '001',
      numNp: '0000020803',
      nItem: 17,
      fecha: '31/07/2026',
      comentario: 'El cliente cambió de opinión',
      operador: 'YALILE'
    }).subscribe();

    const request = httpMock.expectOne((candidate) =>
      candidate.url.endsWith('/nota-pedido-restaurante/eliminar-item')
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body.comentario).toBe('El cliente cambió de opinión');
    expect(request.request.body.operador).toBe('YALILE');
    expect(request.request.body.nItem).toBe(17);
    request.flush({ respuesta: 'OK', tablas: [] });
  });
});
