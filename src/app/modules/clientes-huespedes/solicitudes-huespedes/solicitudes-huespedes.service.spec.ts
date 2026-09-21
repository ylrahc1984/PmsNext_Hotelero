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
});
