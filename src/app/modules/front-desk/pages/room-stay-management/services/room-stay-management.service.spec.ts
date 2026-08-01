import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RoomStayManagementService } from './room-stay-management.service';

describe('RoomStayManagementService', () => {
  let service: RoomStayManagementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(RoomStayManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('updates the comments using reservation, room number and authenticated operator payload', () => {
    const payload = { comentarios: 'Late check-out requested.', operador: 'ATERCERO' };

    service.updateStayComments('NA260000281', '305', payload).subscribe((response) => {
      expect(response).toBe('OK');
    });

    const request = httpMock.expectOne((candidate) =>
      candidate.url.endsWith('/checkin/NA260000281/305/comentarios')
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    expect(request.request.responseType).toBe('text');
    request.flush('OK');
  });
});
