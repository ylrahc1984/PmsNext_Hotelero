import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environments/environment';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';

describe('SolicitudHuespedService', () => {
  let service: SolicitudHuespedService;
  let http: HttpTestingController;
  const apiUrl = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/solicitudes-huesped`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SolicitudHuespedService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el listado con filtros opcionales', () => {
    service.consultar({ estado: 'PEN', area: 'HOUSEKEEPING' }).subscribe();

    const request = http.expectOne(`${apiUrl}?estado=PEN&area=HOUSEKEEPING`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK', data: [] });
  });

  it('envía únicamente la observación al atender', () => {
    service.atender(8, { observacionInterna: 'Se asignó a housekeeping' }).subscribe();

    const request = http.expectOne(`${apiUrl}/8/atender`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ observacionInterna: 'Se asignó a housekeeping' });
    request.flush(null);
  });

  it('consulta el catálogo PMS de tipos de solicitud', () => {
    service.consultarTipos().subscribe((types) => expect(types).toEqual([]));

    const request = http.expectOne(`${apiUrl}/tipos`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK', data: [] });
  });

  it('crea una solicitud con el request mínimo y sin operador', () => {
    const body = {
      idDesglose: 540,
      idRooming: null,
      idTipoSolicitud: 1,
      cantidad: 2,
      comentario: 'Solicitud recibida por teléfono.'
    };

    service.crear(body).subscribe();

    const request = http.expectOne(apiUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.body.operador).toBeUndefined();
    request.flush({ success: true, message: 'OK', data: {} });
  });
});
