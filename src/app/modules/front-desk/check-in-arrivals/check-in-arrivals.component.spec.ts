import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { environment } from 'src/environments/environment';
import { CheckInArrivalsComponent } from './check-in-arrivals.component';
import { CheckInArrival } from './models/check-in-arrival.model';
import { GuestRegistrationPdfService } from './services/guest-registration-pdf.service';

describe('CheckInArrivalsComponent', () => {
  let component: CheckInArrivalsComponent;
  let fixture: ComponentFixture<CheckInArrivalsComponent>;
  let httpMock: HttpTestingController;
  let operationalDateService: {
    operationalDate: ReturnType<typeof signal<string>>;
    ensureLoaded: jasmine.Spy;
    refresh: jasmine.Spy;
  };
  let guestRegistrationPdf: {
    reservePrintWindow: jasmine.Spy;
    printRegistrationForm: jasmine.Spy;
  };

  beforeEach(async () => {
    operationalDateService = {
      operationalDate: signal('29/07/2026'),
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.returnValue(of('29/07/2026')),
      refresh: jasmine.createSpy('refresh').and.returnValue(of('29/07/2026'))
    };
    guestRegistrationPdf = {
      reservePrintWindow: jasmine.createSpy('reservePrintWindow').and.returnValue(null),
      printRegistrationForm: jasmine.createSpy('printRegistrationForm').and.resolveTo()
    };

    await TestBed.configureTestingModule({
      imports: [CheckInArrivalsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: OperationalDateService, useValue: operationalDateService },
        { provide: GuestRegistrationPdfService, useValue: guestRegistrationPdf }
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

  it('marca como pendiente y bloquea Check-In cuando el rooming list está vacío', () => {
    const arrival = makeArrival();
    component.buscar();

    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/checkin/pendientes`)
      .flush([arrival]);
    expect(component.getRoomingListBadgeLabel(component.arrivals[0])).toBe('Verificando rooming');

    httpMock
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rooming-list` &&
          req.params.get('codRsv') === arrival.codReserva &&
          req.params.get('numHabita') === arrival.numHabita
      )
      .flush({ success: true, data: [] });

    expect(component.getRoomingListBadgeLabel(component.arrivals[0])).toBe('Rooming pendiente');
    expect(component.isCheckInDisabled(component.arrivals[0])).toBeTrue();
  });

  it('habilita Check-In cuando existe al menos un huésped', () => {
    const arrival = makeArrival();
    component.buscar();

    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/checkin/pendientes`)
      .flush([arrival]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/rooming-list`).flush({
      success: true,
      data: [{ numInterno: '1', codReserva: arrival.codReserva, numHabita: arrival.numHabita }]
    });

    expect(component.getRoomingListBadgeLabel(component.arrivals[0])).toBe('Rooming registrado');
    expect(component.isCheckInDisabled(component.arrivals[0])).toBeFalse();
  });

  it('imprime con los huéspedes ya consultados sin duplicar la petición de rooming list', async () => {
    const arrival = makeArrival();
    const guest = {
      numInterno: '1', codReserva: arrival.codReserva, numHabita: arrival.numHabita,
      nacionalidad: 'Costa Rica', tipDocu: 'PAS', numDocu: 'P-1', nombre: 'Ana', apellidos: 'Solano',
      fecNaci: '01/01/1990', sexo: '', estCivil: '', tipoPax: 'PAX', direccion: '', email: 'ana@example.com',
      motivo: '8888-8888', procede: '', mdoArribo: '', orden: 1, operador: 'tester'
    };
    component.buscar();
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/checkin/pendientes`).flush([arrival]);
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/rooming-list`).flush({ success: true, data: [guest] });

    await component.generarHojaRegistro(component.arrivals[0]);

    expect(guestRegistrationPdf.printRegistrationForm).toHaveBeenCalledWith(
      component.arrivals[0],
      [jasmine.objectContaining({ numInterno: '1', nombre: 'Ana' })],
      { printWindow: null }
    );
    httpMock.expectNone((req) => req.url === `${environment.apiUrl}/rooming-list`);
  });
});

function makeArrival(): CheckInArrival {
  return {
    numHabita: '101',
    catHabita: 'STD',
    tipHabita: 'DOUBL',
    codReserva: 'RSV-1',
    codTarifa: 'FIT',
    codPlan: 'DYN',
    descripcion: 'Huésped prueba',
    fechaIng: '29/07/2026',
    fechaSal: '30/07/2026',
    procesado: 0,
    numPax: 2,
    numChild: 0,
    cpl: 0,
    totNoches: 1,
    totDias: 2,
    folio: '',
    estado: 'CCR',
    codAgencia: 'DIR',
    nomAgencia: 'Directos',
    observacion: ''
  };
}
