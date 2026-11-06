import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { ConciergeCatalogoService } from './concierge-catalogo.service';
import { TipoSolicitudCatalogo } from './concierge-catalogo.models';

describe('ConciergeCatalogoService', () => {
  let service: ConciergeCatalogoService;
  let http: HttpTestingController;
  const url = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/concierge/catalogo-servicios`;
  const item: TipoSolicitudCatalogo = {
    idTipoSolicitud: 1, nombre: 'Toallas', descripcion: null, nombreEN: null, descripcionEN: null,
    area: 'HOUSEKEEPING', icono: 'towels', orden: 1, permiteCantidad: true, requiereComentario: false, activo: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ConciergeCatalogoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista los registros solo cuando success y data tienen la estructura esperada', () => {
    service.listar().subscribe((result) => expect(result).toEqual([item]));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK', data: [item] });
  });

  it('envía el cuerpo de creación sin identificador ni estado', () => {
    const payload = { nombre: 'Toallas', descripcion: null, nombreEN: null, descripcionEN: null, area: 'HOUSEKEEPING', icono: 'towels', orden: 1, permiteCantidad: true, requiereComentario: false };
    service.crear(payload).subscribe((result) => expect(result).toEqual(item));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body.idTipoSolicitud).toBeUndefined();
    expect(request.request.body.activo).toBeUndefined();
    request.flush({ success: true, message: 'OK', data: item });
  });

  it('envía PATCH con el estado solicitado', () => {
    service.cambiarEstado(1, false).subscribe((result) => expect(result.activo).toBeFalse());
    const request = http.expectOne(`${url}/1/estado`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ activo: false });
    request.flush({ success: true, message: 'OK', data: { ...item, activo: false } });
  });
});
