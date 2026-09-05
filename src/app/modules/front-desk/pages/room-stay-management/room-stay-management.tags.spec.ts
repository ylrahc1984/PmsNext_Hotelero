import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import Swal, { SweetAlertResult } from 'sweetalert2';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ReservaTagAsignado, ReservaTagCatalogo } from 'src/app/modules/Reservas/models/reserva-tag.model';
import { environment } from 'src/environments/environment';
import { RoomStayManagementComponent } from './room-stay-management.component';
import { RoomStayApiData, RoomStayManagementService } from './services/room-stay-management.service';

describe('RoomStayManagementComponent reservation tags', () => {
  let fixture: ComponentFixture<RoomStayManagementComponent>;
  let component: RoomStayManagementComponent;
  let httpMock: HttpTestingController;
  const reservationCode = 'NA260000214';
  const tagsBaseUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/${reservationCode}/tags`;

  beforeEach(async () => {
    const stayService = jasmine.createSpyObj<RoomStayManagementService>('RoomStayManagementService', ['getRoomStay']);
    stayService.getRoomStay.and.returnValue(of(makeStay()));
    const operationalDateService = {
      operationalDate: signal('24/08/2026'),
      loading: signal(false),
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.returnValue(of('24/08/2026'))
    };

    await TestBed.configureTestingModule({
      imports: [RoomStayManagementComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ roomNumber: '101' }) } } },
        { provide: RoomStayManagementService, useValue: stayService },
        { provide: OperationalDateService, useValue: operationalDateService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoomStayManagementComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('does not write the calendar model again on unrelated render cycles', async () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));
    const action = component.operationGroups.flatMap((group) => group.actions).find((item) => item.id === 'change-departure')!;
    component.openActionModal(action);
    fixture.detectChanges();
    await fixture.whenStable();
    const calendar = fixture.debugElement.query(By.directive(NgbDatepicker)).componentInstance as NgbDatepicker;
    const writeValue = spyOn(calendar, 'writeValue').and.callThrough();

    for (let cycle = 0; cycle < 3; cycle++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    expect(writeValue).not.toHaveBeenCalled();
  });

  it('opens the departure calendar and enables confirmation after selecting a new date', async () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));
    const openButton = Array.from(fixture.nativeElement.querySelectorAll('.action-button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Cambiar Fecha Salida'))!;
    openButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ngb-datepicker')).toBeTruthy();
    const nextDate = Array.from(fixture.nativeElement.querySelectorAll('ngb-datepicker .ngb-dp-day') as NodeListOf<HTMLElement>)
      .find((day) => day.textContent?.trim() === '26')!;
    nextDate.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.action-modal__primary').disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('#new-departure-date').value).toBe('26/08/2026');
  });

  it('opens departure changes without an operational date but keeps saving blocked', async () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));
    const operationalDateService = TestBed.inject(OperationalDateService);
    (operationalDateService.operationalDate as ReturnType<typeof signal<string>>).set('');
    const openButton = Array.from(fixture.nativeElement.querySelectorAll('.action-button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Cambiar Fecha Salida'))!;

    openButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ngb-datepicker')).toBeTruthy();
    expect(operationalDateService.ensureLoaded).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.action-modal__primary').disabled).toBeTrue();

    (operationalDateService.operationalDate as ReturnType<typeof signal<string>>).set('24/08/2026');
    component.selectDepartureDate({ day: 26, month: 8, year: 2026 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.action-modal__primary').disabled).toBeFalse();
  });

  it('formats calendar selections as dd/MM/yyyy and compares dates across months', () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));

    component.selectDepartureDate({ day: 5, month: 9, year: 2026 });

    expect(component.actionDraft().newCheckOut).toBe('05/09/2026');
    expect(component.departureDateValidationMessage()).toBe('');

    component.selectDepartureDate({ day: 31, month: 7, year: 2026 });
    expect(component.departureDateValidationMessage()).toContain('anterior a la fecha operativa');
  });

  it('rejects impossible and month-first dates entered into the departure field', () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));

    for (const newCheckOut of ['31/02/2026', '08/25/2026']) {
      component.updateActionDraft({ newCheckOut });
      expect(component.departureCalendarDate(newCheckOut)).toBeNull();
      expect(component.departureDateValidationMessage()).toContain('fecha de salida válida');
    }
  });

  it('loads assigned tags once after obtaining the real reservation code', () => {
    const tag = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([tag]));
    fixture.detectChanges();

    expect(component.assignedReservationTags()).toEqual([tag]);
    expect(fixture.nativeElement.querySelector('.reservation-tags-card').textContent).toContain('VIP');
    httpMock.expectNone(tagsBaseUrl);
  });

  it('keeps the assigned-tag error local and retries the same reservation', () => {
    httpMock.expectOne(tagsBaseUrl).flush(
      { respuesta: 'ERROR|SERVICIO NO DISPONIBLE', exito: false, codigoHttp: 503 },
      { status: 503, statusText: 'Service Unavailable' }
    );
    fixture.detectChanges();

    expect(component.assignedTagsError()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reservation-tags-card').textContent).toContain('Reintentar');

    component.retryAssignedReservationTags();
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([makeAssignedTag(1, 'VIP')]));

    expect(component.assignedTagsError()).toBe('');
    expect(component.assignedReservationTags().map((tag) => tag.idTag)).toEqual([1]);
  });

  it('sends several selected tags through one batch request and merges the response', () => {
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([]));
    const first = makeCatalogTag(1, 'VIP');
    const second = makeCatalogTag(2, 'Llegada tardía');

    component.saveReservationTags([
      { tag: first, observacion: '  Coordinar amenidad  ' },
      { tag: second, observacion: '' }
    ]);

    const request = httpMock.expectOne(`${tagsBaseUrl}/batch`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      tags: [
        { idTag: 1, observacion: 'Coordinar amenidad' },
        { idTag: 2, observacion: null }
      ]
    });
    request.flush({
      ...successfulResponse([makeAssignedTag(1, 'VIP'), makeAssignedTag(2, 'Llegada tardía')]),
      tagsRecibidos: 2,
      tagsInsertados: 2
    });

    expect(component.assignedReservationTags().map((tag) => tag.idTag)).toEqual([2, 1]);
    expect(component.showReservationTagsModal()).toBeFalse();
  });

  it('preserves the modal and current tags when the batch is rejected', () => {
    const existing = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([existing]));
    component.showReservationTagsModal.set(true);

    component.saveReservationTags([{ tag: makeCatalogTag(2, 'Llegada tardía'), observacion: null }]);
    httpMock.expectOne(`${tagsBaseUrl}/batch`).flush({
      datos: null,
      respuesta: 'ERROR|CONFLICTO DE EXCLUSIÓN',
      exito: false,
      codigoHttp: 409
    });

    expect(component.showReservationTagsModal()).toBeTrue();
    expect(component.reservationTagsSaveError()).toContain('CONFLICTO DE EXCLUSIÓN');
    expect(component.assignedReservationTags()).toEqual([existing]);
  });

  it('does not attempt to remove automatic tags', async () => {
    const automatic = makeAssignedTag(1, 'Automática', { tipoAsignacion: 'AUTOMATICO' });
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([automatic]));

    await component.removeReservationTag(automatic);

    httpMock.expectNone((request) => request.url.startsWith(`${tagsBaseUrl}/1`));
    expect(component.assignedReservationTags()).toEqual([automatic]);
  });

  it('removes a manual tag only after a successful DELETE', async () => {
    const manual = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([manual]));
    spyOn(Swal, 'fire').and.resolveTo({ isConfirmed: true, value: 'Ya no aplica' } as SweetAlertResult<string>);

    const removal = component.removeReservationTag(manual);
    await Promise.resolve();
    const request = httpMock.expectOne((candidate) => candidate.url === `${tagsBaseUrl}/1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('motivoRetiro')).toBe('Ya no aplica');
    expect(component.assignedReservationTags()).toEqual([manual]);
    request.flush({ datos: null, respuesta: 'OK|TAG RETIRADO', exito: true, codigoHttp: 200 });
    await removal;

    expect(component.assignedReservationTags()).toEqual([]);
  });

  it('keeps a manual tag when DELETE fails so the user can retry', async () => {
    const manual = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsBaseUrl).flush(successfulResponse([manual]));
    spyOn(Swal, 'fire').and.resolveTo({ isConfirmed: true, value: '' } as SweetAlertResult<string>);

    const removal = component.removeReservationTag(manual);
    await Promise.resolve();
    const request = httpMock.expectOne((candidate) => candidate.url === `${tagsBaseUrl}/1`);
    expect(request.request.params.get('motivoRetiro')).toBe('Retirada desde la gestión de estadía.');
    request.flush(
      { respuesta: 'ERROR|NO SE PUDO RETIRAR', exito: false, codigoHttp: 500 },
      { status: 500, statusText: 'Server Error' }
    );
    await removal;

    expect(component.assignedReservationTags()).toEqual([manual]);
    expect(component.removingReservationTagIds().has(manual.idTag)).toBeFalse();
  });
});

function successfulResponse<T>(datos: T) {
  return { datos, respuesta: 'OK|OPERACIÓN CORRECTA', exito: true, codigoHttp: 200 };
}

function makeStay(): RoomStayApiData {
  return {
    codReserva: 'NA260000214', numHabita: '101', codAgencia: 'DIR', codTarifa: 'FIT', codPlan: 'DYN',
    fechaIng: '24/08/2026', fechaSal: '25/08/2026', noches: 1, numPax: 2, numChild: 0, totDias: 2,
    catHabi: 'STD', tipHabi: 'DBL', credito: 0, limiteCre: 0, monedaLmt: 'USD', tarjeta: '', vence: '',
    autoriza: '', tarxNoc: 0, folio: 'F-1', totalRsv: 100, observacion: '', comentarios: '',
    nombreAgencia: 'Directos', roomingList: [], cargosFolioMaster: [], cargosExtras: []
  };
}

function makeCatalogTag(idTag: number, nombre: string, overrides: Partial<ReservaTagCatalogo> = {}): ReservaTagCatalogo {
  return {
    idCategoria: 1, categoria: 'Experiencia', descripcionCategoria: null, ordenCategoria: 10, idTag, nombre,
    descripcion: 'Descripción', color: '#DBEAFE', icono: 'tag', prioridad: 1, esAlerta: false,
    permiteAsignacionManual: true, grupoExclusion: null, activo: true, ...overrides
  };
}

function makeAssignedTag(idTag: number, nombre: string, overrides: Partial<ReservaTagAsignado> = {}): ReservaTagAsignado {
  return {
    idAsignacion: idTag, codReserva: 'NA260000214', idCategoria: 1, categoria: 'Experiencia', ordenCategoria: 10,
    idTag, nombre, descripcion: 'Descripción', color: '#DBEAFE', icono: 'tag', prioridad: 1, esAlerta: false,
    permiteAsignacionManual: true, grupoExclusion: null, tipoAsignacion: 'MANUAL', origen: 'RESERVA', observacion: null,
    fechaAsignacion: '2026-08-24T11:11:13', operadorAsignacion: 'CHARLY', ...overrides
  };
}
