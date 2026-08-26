import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import Swal, { SweetAlertResult } from 'sweetalert2';

import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { environment } from 'src/environments/environment';
import { ReservaTagAsignado, ReservaTagCatalogo } from '../models/reserva-tag.model';
import { ReservaHospedajeDetalleComponent } from './reserva-hospedaje-detalle.component';
import { ReservaHospedajeDetalle } from './reserva-hospedaje-detalle.model';
import { ReservaHospedajeDetalleService } from './reserva-hospedaje-detalle.service';

describe('ReservaHospedajeDetalleComponent reservation tags', () => {
  let fixture: ComponentFixture<ReservaHospedajeDetalleComponent>;
  let component: ReservaHospedajeDetalleComponent;
  let httpMock: HttpTestingController;
  let routeParams: BehaviorSubject<ParamMap>;
  let detailService: jasmine.SpyObj<ReservaHospedajeDetalleService>;
  const reservationCode = 'EE260000357';
  const apiBase = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ codReserva: reservationCode }));
    detailService = jasmine.createSpyObj<ReservaHospedajeDetalleService>('ReservaHospedajeDetalleService', ['getByReservationCode']);
    detailService.getByReservationCode.and.callFake((code) => of(makeReservation(code)));
    const policy = jasmine.createSpyObj<OperationalPolicyService>('OperationalPolicyService', ['can', 'require', 'decision']);
    policy.can.and.returnValue(true);
    policy.require.and.resolveTo(true);
    policy.decision.and.returnValue({
      allowed: true,
      code: 'ALLOWED',
      action: OperationalAction.UpdateOperation,
      actionLabel: 'modificar una operación',
      status: 'OPEN',
      operationalDate: '24/08/2026',
      calendarDate: '24/08/2026',
      reason: ''
    });
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);

    await TestBed.configureTestingModule({
      imports: [ReservaHospedajeDetalleComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: ReservaHospedajeDetalleService, useValue: detailService },
        { provide: OperationalPolicyService, useValue: policy },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReservaHospedajeDetalleComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('loads assigned tags once and renders the subsection before observations', () => {
    const tag = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([tag]));
    fixture.detectChanges();

    const generalCard = fixture.nativeElement.querySelector('.detail-card');
    const tagsSection = generalCard.querySelector('.reservation-tags-section');
    const observations = generalCard.querySelector('.note-box');
    expect(tagsSection.textContent).toContain('VIP');
    expect(tagsSection.compareDocumentPosition(observations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    httpMock.expectNone(tagsUrl(reservationCode));
  });

  it('refreshes reservation detail and tags exactly once through Actualizar', () => {
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([]));
    expect(detailService.getByReservationCode).toHaveBeenCalledTimes(1);

    component.reload();
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([makeAssignedTag(1, 'VIP')]));

    expect(detailService.getByReservationCode).toHaveBeenCalledTimes(2);
    expect(component.assignedReservationTags().map((tag) => tag.idTag)).toEqual([1]);
  });

  it('shows a local assigned-tag error and retries without reloading reservation detail', () => {
    httpMock.expectOne(tagsUrl(reservationCode)).flush({
      datos: null,
      respuesta: 'ERROR|SERVICIO NO DISPONIBLE',
      exito: false,
      codigoHttp: 503
    });
    fixture.detectChanges();

    expect(component.assignedTagsError()).toContain('SERVICIO NO DISPONIBLE');
    expect(fixture.nativeElement.querySelector('.reservation-tags-section__error').textContent).toContain('Reintentar');
    component.retryAssignedReservationTags();
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([makeAssignedTag(1, 'VIP')]));

    expect(detailService.getByReservationCode).toHaveBeenCalledTimes(1);
    expect(component.assignedTagsError()).toBe('');
    expect(component.assignedReservationTags().length).toBe(1);
  });

  it('ignores obsolete tag responses after the route changes', () => {
    const oldRequest = httpMock.expectOne(tagsUrl(reservationCode));
    const nextCode = 'EE260000358';

    routeParams.next(convertToParamMap({ codReserva: nextCode }));
    fixture.detectChanges();
    httpMock.expectOne(tagsUrl(nextCode)).flush(successfulResponse([makeAssignedTag(2, 'Nueva', { codReserva: nextCode })]));
    oldRequest.flush(successfulResponse([makeAssignedTag(1, 'Anterior')]));

    expect(component.codReserva()).toBe(nextCode);
    expect(component.assignedReservationTags().map((tag) => tag.idTag)).toEqual([2]);
  });

  it('shows six tags and opens the complete detail without loading the manual catalog', () => {
    const tags = Array.from({ length: 8 }, (_, index) => makeAssignedTag(index + 1, `Tag ${index + 1}`));
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse(tags));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag-chip').length).toBe(6);
    expect(fixture.nativeElement.querySelector('.tag-more').textContent).toContain('+2 más');
    fixture.nativeElement.querySelector('.tag-more').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag-detail').length).toBe(8);
    expect(fixture.nativeElement.querySelector('.tag-modal__body').textContent).not.toContain('Agregar etiquetas');
    httpMock.expectNone((request) => request.url === `${apiBase}/reservas/tags`);
  });

  it('keeps tags visible but hides management and removal for a read-only reservation', () => {
    const automatic = makeAssignedTag(1, 'Sistema', { tipoAsignacion: 'AUTOMATICO' });
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([automatic]));
    component.reserva.set(makeReservation(reservationCode, 'ANU'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tag-chip')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reservation-tags-section__action--manage')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tag-chip__remove')).toBeNull();
    expect(fixture.nativeElement.querySelector('.topbar-actions button:nth-child(2)').disabled).toBeFalse();
  });

  it('sends all new tags in one batch and normalizes observations', () => {
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([]));
    component.saveReservationTags([
      { tag: makeCatalogTag(1, 'VIP'), observacion: '  Coordinar amenidad  ' },
      { tag: makeCatalogTag(2, 'Llegada tardía'), observacion: '' }
    ]);

    const request = httpMock.expectOne(`${tagsUrl(reservationCode)}/batch`);
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

  it('keeps the management modal and assigned tags unchanged after a batch business failure', () => {
    const existing = makeAssignedTag(1, 'VIP');
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([existing]));
    component.showReservationTagsModal.set(true);

    component.saveReservationTags([{ tag: makeCatalogTag(2, 'Llegada tardía'), observacion: 'Después de las 22:00' }]);
    httpMock.expectOne(`${tagsUrl(reservationCode)}/batch`).flush({
      datos: null,
      respuesta: 'ERROR|CONFLICTO DE EXCLUSIÓN',
      exito: false,
      codigoHttp: 409
    });

    expect(component.showReservationTagsModal()).toBeTrue();
    expect(component.reservationTagsSaveError()).toContain('CONFLICTO DE EXCLUSIÓN');
    expect(component.assignedReservationTags()).toEqual([existing]);
  });

  it('removes a manual tag only after the encoded DELETE succeeds and protects automatic tags', async () => {
    const manual = makeAssignedTag(1, 'VIP');
    const automatic = makeAssignedTag(2, 'Sistema', { tipoAsignacion: 'AUTOMATICO' });
    httpMock.expectOne(tagsUrl(reservationCode)).flush(successfulResponse([manual, automatic]));
    spyOn(Swal, 'fire').and.resolveTo({ isConfirmed: true, value: 'Ya no aplica' } as SweetAlertResult<string>);

    await component.removeReservationTag(automatic);
    httpMock.expectNone((request) => request.url.endsWith('/tags/2'));

    const removal = component.removeReservationTag(manual);
    await Promise.resolve();
    const request = httpMock.expectOne((candidate) => candidate.url === `${tagsUrl(reservationCode)}/1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('motivoRetiro')).toBe('Ya no aplica');
    expect(component.assignedReservationTags().length).toBe(2);
    request.flush({ datos: null, respuesta: 'OK|TAG RETIRADO', exito: true, codigoHttp: 200 });
    await removal;

    expect(component.assignedReservationTags()).toEqual([automatic]);
  });
});

function tagsUrl(codReserva: string): string {
  return `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/${codReserva}/tags`;
}

function successfulResponse<T>(datos: T) {
  return { datos, respuesta: 'OK|OPERACIÓN CORRECTA', exito: true, codigoHttp: 200 };
}

function makeReservation(codReserva: string, estado = 'CON'): ReservaHospedajeDetalle {
  return {
    codReserva, codAgencia: 'DIR', nomAgencia: 'Directos', codTarifa: 'FIT', nomTarifa: 'Flexible', codPlan: 'DYN',
    planAlimenticio: 'Desayuno', fecIngresa: '24/08/2026', fecIngreso: '24/08/2026', fecSalida: '25/08/2026',
    fecCreacion: '23/08/2026', fecConfirma: '', fecPrepago: '', fecAnulada: '', totNoches: 1, totDias: 2,
    descripcion: 'Reserva de prueba', tCambio: 1, folio: 'F-1', estado, moneda: 'USD', totalRsv: 100,
    observacion: 'Observación de prueba', observaciones: '', procesado: 0, directo: true, operador: 'CHARLY',
    habitaciones: [], inclusiones: [], servicios: [], desgloseHabitaciones: []
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
    idAsignacion: idTag, codReserva: 'EE260000357', idCategoria: 1, categoria: 'Experiencia', ordenCategoria: 10,
    idTag, nombre, descripcion: 'Descripción', color: '#DBEAFE', icono: 'tag', prioridad: 1, esAlerta: false,
    permiteAsignacionManual: true, grupoExclusion: null, tipoAsignacion: 'MANUAL', origen: 'RESERVA', observacion: null,
    fechaAsignacion: '2026-08-24T11:11:13', operadorAsignacion: 'CHARLY', ...overrides
  };
}
