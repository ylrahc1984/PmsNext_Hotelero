import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { AnalisisHuespedesComponent } from './analisis-huespedes.component';
import { ReporteHuespedMercadeo } from './analisis-huespedes.models';
import { AnalisisHuespedesService } from './analisis-huespedes.service';

describe('AnalisisHuespedesComponent', () => {
  let fixture: ComponentFixture<AnalisisHuespedesComponent>;
  let component: AnalisisHuespedesComponent;

  const rows: ReporteHuespedMercadeo[] = Array.from({ length: 25 }, (_, index) => ({
    idRooming: index + 1,
    codReserva: `RES-${index + 1}`,
    numHabitacion: String(index + 1),
    nombreCompleto: index === 0 ? 'Ana Gómez' : `Huésped ${index + 1}`,
    tipoDocumento: '01',
    numeroDocumento: String(index + 100),
    codNacionalidad: index === 0 ? 'CRI' : 'BEL',
    nacionalidad: index === 0 ? 'COSTA RICA' : 'BÉLGICA',
    email: null,
    tipoEmail: 'SIN CORREO',
    telefono: null,
    estadoContacto: 'SIN CONTACTO',
    esContactable: false,
    tipoPax: 'PAX',
    fechaIngreso: '2026-08-01T00:00:00',
    fechaSalida: '2026-08-02T00:00:00',
    noches: 1,
    codAgencia: '1',
    nomAgencia: 'BOOKING.COM',
    codTarifa: 'FIT',
    codPlan: 'RO',
    estadoReserva: 'CHK',
    esReservaDirecta: 'N',
    operadorReserva: 'CHANNEL',
    registrosMismaEstancia: 1,
    fueConsolidado: false
  }));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AnalisisHuespedesComponent],
      providers: [
        { provide: AnalisisHuespedesService, useValue: { getReporteHuespedesMercadeo: () => of(rows) } },
        {
          provide: OperationalDateService,
          useValue: { operationalDate: signal('05/08/2026'), ensureLoaded: () => of('05/08/2026') }
        },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning']) }
      ]
    });
    TestBed.overrideComponent(AnalisisHuespedesComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(AnalisisHuespedesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('usa la fecha operativa para el mes por defecto', () => {
    expect(component.filtersForm.controls.fechaDesde.value).toBe('2026-08-01');
    expect(component.filtersForm.controls.fechaHasta.value).toBe('2026-08-05');
  });

  it('reinicia la paginación al aplicar búsqueda debounced', fakeAsync(() => {
    component.nextPage();
    expect(component.page).toBe(2);
    component.filtersForm.controls.search.setValue('Ana Gomez');
    tick(251);
    expect(component.page).toBe(1);
    expect(component.filteredRows).toHaveSize(1);
  }));

  it('presenta singular y plural de noches', () => {
    expect(component.nightsLabel(1)).toBe('1 noche');
    expect(component.nightsLabel(2)).toBe('2 noches');
  });
});
