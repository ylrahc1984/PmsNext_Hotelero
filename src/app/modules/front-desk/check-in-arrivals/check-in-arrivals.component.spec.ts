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
import { ReservaTagAsignado } from 'src/app/modules/Reservas/models/reserva-tag.model';

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
    flushTags(arrival.codReserva);

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
    flushTags(arrival.codReserva);

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
    flushTags(arrival.codReserva);

    await component.generarHojaRegistro(component.arrivals[0]);

    expect(guestRegistrationPdf.printRegistrationForm).toHaveBeenCalledWith(
      component.arrivals[0],
      [jasmine.objectContaining({ numInterno: '1', nombre: 'Ana' })],
      { printWindow: null }
    );
    httpMock.expectNone((req) => req.url === `${environment.apiUrl}/rooming-list`);
  });

  it('consulta las etiquetas una sola vez cuando la reserva aparece en varias habitaciones', () => {
    const first = { ...makeArrival(), procesado: 1 };
    const second = { ...makeArrival(), numHabita: '102', folio: '2', procesado: 1 };
    component.buscar();

    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/checkin/pendientes`).flush([first, second]);
    const tagRequests = httpMock.match((req) => req.url === `${environment.apiUrl}/reservas/${first.codReserva}/tags`);

    expect(tagRequests.length).toBe(1);
    tagRequests[0].flush(successfulTags([]));
  });

  it('prioriza alertas, limita el resumen y permite ver el detalle completo', () => {
    const arrival = { ...makeArrival(), procesado: 1 };
    component.buscar();
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/checkin/pendientes`).flush([arrival]);
    flushTags(arrival.codReserva, [
      makeTag(1, 'Regular', { prioridad: 1 }),
      makeTag(2, 'VIP', { prioridad: 5 }),
      makeTag(3, 'Atencion', { esAlerta: true, prioridad: 2 })
    ]);
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('.reservation-tags-summary') as HTMLElement;
    expect(summary.textContent).toContain('Atencion');
    expect(summary.textContent).toContain('VIP');
    expect(summary.textContent).toContain('+1');
    expect(summary.textContent).not.toContain('Regular');

    (summary.querySelector('.tag-more') as HTMLButtonElement).click();
    fixture.detectChanges();

    const detail = fixture.nativeElement.querySelector('.reservation-detail') as HTMLElement;
    expect(detail.textContent).toContain('Atencion');
    expect(detail.textContent).toContain('VIP');
    expect(detail.textContent).toContain('Regular');
  });

  function flushTags(codReserva: string, tags: ReservaTagAsignado[] = []): void {
    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/reservas/${codReserva}/tags`)
      .flush(successfulTags(tags));
  }
});

function successfulTags(tags: ReservaTagAsignado[]) {
  return { datos: tags, respuesta: 'OK|Consulta exitosa', exito: true, codigoHttp: 200 };
}

function makeTag(idTag: number, nombre: string, overrides: Partial<ReservaTagAsignado> = {}): ReservaTagAsignado {
  return {
    idAsignacion: idTag,
    codReserva: 'RSV-1',
    idCategoria: 1,
    categoria: 'Atencion',
    ordenCategoria: 1,
    idTag,
    nombre,
    descripcion: null,
    color: '#E5E7EB',
    icono: 'tag',
    prioridad: 0,
    esAlerta: false,
    permiteAsignacionManual: true,
    grupoExclusion: null,
    tipoAsignacion: 'MANUAL',
    origen: null,
    observacion: null,
    fechaAsignacion: '24/08/2026',
    operadorAsignacion: 'tester',
    ...overrides
  };
}

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
