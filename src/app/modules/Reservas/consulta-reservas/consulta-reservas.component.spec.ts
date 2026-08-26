import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { ReservaConsulta } from '../models/reserva-consulta.model';
import { ReservaTagResumen } from '../models/reserva-tag.model';
import { ReservaHabitacionService } from '../services/reserva-habitacion.service';
import { ReservaTagsService } from '../services/reserva-tags.service';
import { ConsultaReservasComponent } from './consulta-reservas.component';

describe('ConsultaReservasComponent', () => {
  let component: ConsultaReservasComponent;
  let fixture: ComponentFixture<ConsultaReservasComponent>;
  let reservaService: jasmine.SpyObj<ReservaHabitacionService>;
  let reservaTagsService: jasmine.SpyObj<ReservaTagsService>;
  let operationalDateService: {
    operationalDate: ReturnType<typeof signal<string>>;
    ensureLoaded: jasmine.Spy;
    refresh: jasmine.Spy;
  };
  let operationalPolicy: jasmine.SpyObj<OperationalPolicyService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    reservaService = jasmine.createSpyObj<ReservaHabitacionService>('ReservaHabitacionService', [
      'consultarReservas',
      'buscarReservas',
      'anularReserva',
      'cambiarEstadoReserva',
      'getConfirmacionPdf'
    ]);
    reservaService.consultarReservas.and.returnValue(
      of({
        reservas: [],
        totalRegistros: 0,
        paginaActual: 1,
        tamanoPagina: 10,
        totalPaginas: 1
      })
    );
    reservaService.buscarReservas.and.returnValue(
      of({
        reservas: [],
        totalRegistros: 0,
        paginaActual: 1,
        tamanoPagina: 10,
        totalPaginas: 1
      })
    );
    reservaTagsService = jasmine.createSpyObj<ReservaTagsService>('ReservaTagsService', ['obtenerTagsReserva']);
    reservaTagsService.obtenerTagsReserva.and.returnValue(
      of({ datos: [], respuesta: 'OK|TAGS ACTIVOS CONSULTADOS', exito: true, codigoHttp: 200 })
    );

    operationalDateService = {
      operationalDate: signal('29/07/2026'),
      ensureLoaded: jasmine.createSpy('ensureLoaded').and.returnValue(of('29/07/2026')),
      refresh: jasmine.createSpy('refresh').and.returnValue(of('29/07/2026'))
    };
    operationalPolicy = jasmine.createSpyObj<OperationalPolicyService>('OperationalPolicyService', ['can', 'require']);
    operationalPolicy.can.and.returnValue(true);
    operationalPolicy.require.and.resolveTo(true);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ConsultaReservasComponent, HttpClientTestingModule],
      providers: [
        { provide: ReservaHabitacionService, useValue: reservaService },
        { provide: ReservaTagsService, useValue: reservaTagsService },
        { provide: WalkInService, useValue: { searchAgencias: () => of([]) } },
        { provide: AuthService, useValue: { getCurrentUser: () => ({ usuario: 'TEST' }) } },
        { provide: OperationalDateService, useValue: operationalDateService },
        { provide: OperationalPolicyService, useValue: operationalPolicy },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultaReservasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('inicializa el rango desde la fecha operativa', () => {
    expect(component.filterForm.controls.fechaInicio.value).toBe('2026-07-29');
    expect(component.filterForm.controls.fechaFinal.value).toBe('2026-07-31');
    expect(reservaService.consultarReservas).toHaveBeenCalledWith(
      jasmine.objectContaining({
        fecIngreso: '29/07/2026',
        fecSalida: '31/07/2026'
      })
    );
  });

  it('restringe prepagos para reservas con check-in o canceladas', () => {
    expect(component.puedeAdministrarPrepagos(buildReserva('ABI'))).toBeTrue();
    expect(component.puedeAdministrarPrepagos(buildReserva('CCR'))).toBeTrue();
    expect(component.puedeAdministrarPrepagos(buildReserva('WLT'))).toBeTrue();
    expect(component.puedeAdministrarPrepagos(buildReserva('WLI'))).toBeTrue();
    expect(component.puedeAdministrarPrepagos(buildReserva('CHK'))).toBeFalse();
    expect(component.puedeAdministrarPrepagos(buildReserva('ANU'))).toBeFalse();
  });

  it('no abre el modal de prepagos cuando el estado está restringido', async () => {
    await component.abrirPrepagos(buildReserva('CHK'));

    expect(component.prepaymentsOpen()).toBeFalse();
    expect(operationalPolicy.require).not.toHaveBeenCalled();
  });

  it('actualiza la fecha operativa y recarga al recuperar el foco', () => {
    reservaService.consultarReservas.calls.reset();

    window.dispatchEvent(new Event('focus'));

    expect(operationalDateService.refresh).toHaveBeenCalled();
    expect(operationalPolicy.can).toHaveBeenCalledWith(OperationalAction.View);
    expect(reservaService.consultarReservas).toHaveBeenCalledTimes(1);
  });

  it('no abre una nueva reserva cuando la política operativa la rechaza', async () => {
    operationalPolicy.require.and.resolveTo(false);

    await component.nuevaReserva();

    expect(operationalPolicy.require).toHaveBeenCalledWith(OperationalAction.CreateOperation);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('usa buscar-reservas únicamente cuando la búsqueda rápida tiene texto', async () => {
    reservaService.consultarReservas.calls.reset();

    component.quickSearchControl.setValue('mario', { emitEvent: false });
    await component.buscar();

    expect(reservaService.buscarReservas).toHaveBeenCalledWith('mario', 1, 10);
    expect(reservaService.consultarReservas).not.toHaveBeenCalled();
  });

  it('muestra dos tags embebidos y abre el detalle completo desde +N', () => {
    const reserva = buildReserva('CCR');
    reserva.tags = [makeTag(1, 'VIP'), makeTag(2, 'Alerta', true), makeTag(3, 'Llegada tardía')];
    reserva.cantidadTags = 3;
    reserva.tieneAlertas = true;
    component.reservas.set([reserva]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reservation-row-tags .tag-chip').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.reservation-row-tags .tag-more').textContent).toContain('+1');
    fixture.nativeElement.querySelector('.reservation-row-tags .tag-more').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tag-details-modal .tag-detail').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.tag-details-modal').textContent).toContain(reserva.reserva);
  });

  it('no muestra texto de estado vacío cuando una reserva no tiene tags', () => {
    component.reservas.set([buildReserva('ABI'), { ...buildReserva('CCR'), reserva: 'RS26000002' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reservation-row-tags').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.reserva-table').textContent).not.toContain('Sin etiquetas');
  });

  it('consulta y muestra los tags activos de cada reserva listada', async () => {
    const reserva = { ...buildReserva('CCR'), reserva: 'NA260000372' };
    const tags = [makeTag(1, 'VIP'), makeTag(30, 'ADULTO MAYOR'), makeTag(4, 'CUMPLEAÑOS')];
    const assignedTags = tags.map((tag, index) => ({
      ...tag,
      idAsignacion: index + 1,
      codReserva: reserva.reserva,
      tipoAsignacion: 'MANUAL',
      origen: 'RESERVA',
      observacion: null,
      permiteAsignacionManual: true,
      grupoExclusion: null,
      fechaAsignacion: '2026-08-24T17:10:19',
      operadorAsignacion: 'CHARLY'
    }));
    reservaService.consultarReservas.and.returnValue(of({
      reservas: [reserva],
      totalRegistros: 1,
      paginaActual: 1,
      tamanoPagina: 10,
      totalPaginas: 1
    }));
    reservaTagsService.obtenerTagsReserva.and.returnValue(
      of({ datos: assignedTags, respuesta: 'OK|TAGS ACTIVOS CONSULTADOS CORRECTAMENTE', exito: true, codigoHttp: 200 })
    );

    await component.buscar();
    fixture.detectChanges();

    expect(reservaTagsService.obtenerTagsReserva).toHaveBeenCalledWith('NA260000372');
    expect(component.reservas()[0].tags.map((tag) => tag.nombre)).toEqual(['VIP', 'ADULTO MAYOR', 'CUMPLEAÑOS']);
    expect(fixture.nativeElement.querySelectorAll('.reservation-row-tags .tag-chip').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.reservation-row-tags .tag-more').textContent).toContain('+1');
  });

  it('dirige la gestión de tags al detalle reutilizable cuando la reserva es modificable', async () => {
    const reserva = buildReserva('CCR');

    await component.gestionarEtiquetas(reserva);

    expect(operationalPolicy.require).toHaveBeenCalledWith(OperationalAction.UpdateOperation);
    expect(router.navigate).toHaveBeenCalledWith(['/reservas/detalle-hospedaje', reserva.reserva]);
  });

  it('exporta nombres de tags y alerta sin metadatos técnicos', () => {
    const reserva = buildReserva('CCR');
    reserva.tags = [makeTag(1, 'VIP'), makeTag(2, 'Alergia', true)];
    reserva.tieneAlertas = true;
    component.reservas.set([reserva]);
    const consoleInfo = spyOn(console, 'info');

    component.exportar();

    const csv = String(consoleInfo.calls.mostRecent().args[0]);
    expect(csv).toContain('Etiquetas,Tiene alerta');
    expect(csv).toContain('VIP | Alergia,Sí');
    expect(csv).not.toContain('#DBEAFE');
  });
});

function buildReserva(estado: string): ReservaConsulta {
  return {
    reserva: 'RS26000001',
    codAgencia: '',
    codTarifa: '',
    codPlan: '',
    categoria: '',
    habOrigen: '',
    agencia: '',
    descripcion: 'Reserva de prueba',
    ingreso: '29/07/2026',
    salida: '31/07/2026',
    noches: 2,
    habitaciones: 1,
    pax: 2,
    ninos: 0,
    estado,
    total: 100,
    prepago: 'N',
    moneda: 'USD',
    tCambio: 1,
    operador: 'TEST',
    tags: [],
    cantidadTags: 0,
    tieneAlertas: false
  };
}

function makeTag(idTag: number, nombre: string, esAlerta = false): ReservaTagResumen {
  return {
    idTag,
    idCategoria: 1,
    categoria: 'Experiencia',
    ordenCategoria: 10,
    nombre,
    descripcion: `${nombre} descripción`,
    color: '#DBEAFE',
    icono: 'tag',
    prioridad: esAlerta ? 3 : 1,
    esAlerta,
    tipoAsignacion: 'MANUAL',
    observacion: null
  };
}
