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
import { ReservaHabitacionService } from '../services/reserva-habitacion.service';
import { ConsultaReservasComponent } from './consulta-reservas.component';

describe('ConsultaReservasComponent', () => {
  let component: ConsultaReservasComponent;
  let fixture: ComponentFixture<ConsultaReservasComponent>;
  let reservaService: jasmine.SpyObj<ReservaHabitacionService>;
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
    operador: 'TEST'
  };
}
