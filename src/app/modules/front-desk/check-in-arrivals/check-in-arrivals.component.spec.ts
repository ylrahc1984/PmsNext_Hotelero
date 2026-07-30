import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { environment } from 'src/environments/environment';
import { CheckInArrivalsComponent } from './check-in-arrivals.component';

describe('CheckInArrivalsComponent', () => {
  let component: CheckInArrivalsComponent;
  let fixture: ComponentFixture<CheckInArrivalsComponent>;
  let httpMock: HttpTestingController;
  let operationalDateService: {
    operationalDate: ReturnType<typeof signal<string>>;
    ensureLoaded: jasmine.Spy;
    refresh: jasmine.Spy;
  };

  beforeEach(async () => {
    operationalDateService = {
      operationalDate: signal('29/07/2026'),
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.returnValue(of('29/07/2026')),
      refresh: jasmine.createSpy('refresh').and.returnValue(of('29/07/2026'))
    };

    await TestBed.configureTestingModule({
      imports: [CheckInArrivalsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: OperationalDateService, useValue: operationalDateService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckInArrivalsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const request = httpMock.expectOne(
      (req) => req.url === `${environment.apiUrl}/checkin/pendientes` && req.params.get('fecIngreso') === '29/07/2026'
    );
    request.flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/tipoidentificacion')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/nacionalidad')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('inicializa el filtro con la fecha operativa', () => {
    expect(component.filtersForm.controls.fechaIngreso.value).toBe('2026-07-29');
    expect(operationalDateService.ensureLoaded).toHaveBeenCalled();
  });

  it('actualiza el día operativo y recarga los arribos al recuperar el foco', () => {
    operationalDateService.refresh.and.returnValue(of('30/07/2026'));

    window.dispatchEvent(new Event('focus'));

    const request = httpMock.expectOne(
      (req) => req.url === `${environment.apiUrl}/checkin/pendientes` && req.params.get('fecIngreso') === '30/07/2026'
    );
    request.flush([]);
    expect(component.filtersForm.controls.fechaIngreso.value).toBe('2026-07-30');
  });
});
