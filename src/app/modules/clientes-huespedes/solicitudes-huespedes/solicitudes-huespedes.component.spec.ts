import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ToastService } from 'src/app/core/services/toast.service';
import { CheckInArrivalsService } from 'src/app/modules/front-desk/check-in-arrivals/services/check-in-arrivals.service';
import { InHouseGuestsService } from 'src/app/modules/front-desk/in-house-guests/services/in-house-guests.service';
import { SolicitudesHuespedesComponent } from './solicitudes-huespedes.component';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';

describe('SolicitudesHuespedesComponent', () => {
  let component: SolicitudesHuespedesComponent;
  let fixture: ComponentFixture<SolicitudesHuespedesComponent>;
  let solicitudService: jasmine.SpyObj<SolicitudHuespedService>;
  let inHouseService: jasmine.SpyObj<InHouseGuestsService>;
  let roomingService: jasmine.SpyObj<CheckInArrivalsService>;

  beforeEach(async () => {
    solicitudService = jasmine.createSpyObj('SolicitudHuespedService', ['consultar', 'consultarTipos', 'crear']);
    solicitudService.consultar.and.returnValue(of([]));
    solicitudService.consultarTipos.and.returnValue(of([]));
    solicitudService.crear.and.returnValue(of({} as any));

    inHouseService = jasmine.createSpyObj('InHouseGuestsService', ['getInHouseGuests']);
    inHouseService.getInHouseGuests.and.returnValue(of({ pax: [], totalHabitaciones: 0, totalAdultos: 0, totalNinos: 0, totalHuespedes: 0, respuesta: '' }));

    roomingService = jasmine.createSpyObj('CheckInArrivalsService', ['getRoomingList']);
    roomingService.getRoomingList.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SolicitudesHuespedesComponent],
      providers: [
        { provide: SolicitudHuespedService, useValue: solicitudService },
        { provide: InHouseGuestsService, useValue: inHouseService },
        { provide: CheckInArrivalsService, useValue: roomingService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudesHuespedesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('activa y retira la validación de cantidad según el tipo', () => {
    component.requestTypes = [
      { idTipoSolicitud: 1, nombre: 'Toallas', descripcion: null, area: 'HOUSEKEEPING', icono: null, orden: 1, permiteCantidad: true, requiereComentario: false },
      { idTipoSolicitud: 2, nombre: 'Mantenimiento', descripcion: null, area: 'MANTENIMIENTO', icono: null, orden: 2, permiteCantidad: false, requiereComentario: true }
    ];

    component.createForm.controls.idTipoSolicitud.setValue(1);
    expect(component.createForm.controls.cantidad.hasError('required')).toBeTrue();

    component.createForm.controls.cantidad.setValue(3);
    component.createForm.controls.idTipoSolicitud.setValue(2);
    expect(component.createForm.controls.cantidad.value).toBeNull();
    expect(component.createForm.controls.cantidad.validator).toBeNull();
    expect(component.createForm.controls.comentario.hasError('required')).toBeTrue();
  });

  it('limpia el huésped anterior al cambiar de habitación', () => {
    component.inHouseGuests = [{
      numHabita: '2', paxIn: '/ Ana', fechaIng: '20/09/2026', fechaSal: '22/09/2026', noches: 2,
      desayuno: 'SI', media: 'NO', fullPen: 'NO', numPax: 1, numChild: 0, varios: '0',
      codReserva: 'NA1', nomAgencia: 'Directos', idDesglose: 540
    }];
    component.createForm.controls.idRooming.setValue(361);

    component.onRoomChange(540);

    expect(component.selectedInHouseGuest?.idDesglose).toBe(540);
    expect(component.createForm.controls.idRooming.value).toBeNull();
    expect(roomingService.getRoomingList).toHaveBeenCalledWith('NA1', '2');
  });

  it('refresca el listado después de una creación exitosa', () => {
    component.requestTypes = [{
      idTipoSolicitud: 1, nombre: 'Toallas', descripcion: null, area: 'HOUSEKEEPING', icono: null, orden: 1,
      permiteCantidad: false, requiereComentario: false
    }];
    component.inHouseGuests = [{
      numHabita: '2', paxIn: '/ Ana', fechaIng: '20/09/2026', fechaSal: '22/09/2026', noches: 2,
      desayuno: 'SI', media: 'NO', fullPen: 'NO', numPax: 1, numChild: 0, varios: '0',
      codReserva: 'NA1', nomAgencia: 'Directos', idDesglose: 540
    }];
    component.onRoomChange(540);
    component.createForm.patchValue({ idTipoSolicitud: 1 });
    const consultarSpy = spyOn(component, 'consultar').and.stub();

    component.submitCreate();

    expect(solicitudService.crear).toHaveBeenCalledWith({
      idDesglose: 540, idRooming: null, idTipoSolicitud: 1, cantidad: null, comentario: null
    });
    expect(consultarSpy).toHaveBeenCalled();
  });
});
