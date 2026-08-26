import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environments/environment';
import { GuardarReservaContactoRequest } from '../models/reserva-contacto.model';
import { ReservaContactoService } from './reserva-contacto.service';

describe('ReservaContactoService', () => {
  let service: ReservaContactoService;
  let httpMock: HttpTestingController;
  const baseUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ReservaContactoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the contact for an encoded reservation code', () => {
    service.obtenerContactoReserva(' NA/260000372 ').subscribe();

    const request = httpMock.expectOne(`${baseUrl}/NA%2F260000372/contacto`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'OK|CONTACTO CONSULTADO', data: null });
  });

  it('saves one normalized contact request with PUT', () => {
    const payload: GuardarReservaContactoRequest = {
      nombre: 'Charly Quispe Hualla',
      email: null,
      telefono: '8711-8639'
    };

    service.guardarContactoReserva('NA260000372', payload).subscribe();

    const request = httpMock.expectOne(`${baseUrl}/NA260000372/contacto`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ success: true, message: 'OK|CONTACTO GUARDADO', data: null });
  });
});
