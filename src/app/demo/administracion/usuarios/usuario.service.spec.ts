import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from 'src/app/core/services/auth.service';
import { UsuarioService } from './usuario.service';

describe('UsuarioService general privileges', () => {
  let service: UsuarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: {} }
      ]
    });

    service = TestBed.inject(UsuarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('denies deletion when MPVELIPLA returns FALSE', () => {
    service.tienePrivilegioGeneral('MPVELIPLA', 'PVTCH', 'YALILE').subscribe((allowed) => {
      expect(allowed).toBeFalse();
    });

    const request = httpMock.expectOne((candidate) =>
      candidate.url.endsWith('/privilegiogeneral/valorprivilegio') &&
      candidate.params.get('codParametro') === 'MPVELIPLA' &&
      candidate.params.get('modulo') === 'PVTCH' &&
      candidate.params.get('usuario') === 'YALILE'
    );

    expect(request.request.method).toBe('GET');
    request.flush([{ Valor: 'FALSE' }]);
  });
});
