import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalisisHuespedesService } from './analisis-huespedes.service';

describe('AnalisisHuespedesService', () => {
  let service: AnalisisHuespedesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AnalisisHuespedesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el endpoint con parámetros codificados y fechas dd/MM/yyyy', () => {
    service.getReporteHuespedesMercadeo('2026-08-01', '2026-08-05').subscribe((rows) => expect(rows).toEqual([]));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/reporte-huespedes-mercadeo'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('FechaDesde')).toBe('01/08/2026');
    expect(request.request.params.get('FechaHasta')).toBe('05/08/2026');
    request.flush([]);
  });
});
