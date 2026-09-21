import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SolicitudHuesped } from './solicitudes-huespedes.models';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';
import { GuestRequestNotificationService } from './guest-request-notification.service';

describe('GuestRequestNotificationService', () => {
  let service: GuestRequestNotificationService;
  let solicitudesService: jasmine.SpyObj<SolicitudHuespedService>;
  let toast: jasmine.SpyObj<ToastService>;
  let authState$: Subject<boolean>;

  const request = (idSolicitud: number, room: string, type = 'Toallas adicionales'): SolicitudHuesped => ({
    idSolicitud,
    idPortal: null,
    idDesglose: 500 + idSolicitud,
    codReserva: `RSV-${idSolicitud}`,
    idRooming: null,
    numHabitacion: room,
    idTipoSolicitud: 1,
    tipoSolicitud: type,
    area: 'HOUSEKEEPING',
    cantidad: null,
    comentario: null,
    estado: 'PEN',
    fechaSolicitud: `2026-09-21T11:${String(idSolicitud).padStart(2, '0')}:00`,
    fechaAtencion: null,
    fechaCompletada: null,
    fechaCancelada: null,
    operadorAtencion: null,
    operadorCompleta: null,
    observacionInterna: null,
    minutosDesdeSolicitud: idSolicitud
  });

  beforeEach(() => {
    solicitudesService = jasmine.createSpyObj('SolicitudHuespedService', ['consultar']);
    toast = jasmine.createSpyObj('ToastService', ['info']);
    authState$ = new Subject<boolean>();

    TestBed.configureTestingModule({
      providers: [
        GuestRequestNotificationService,
        { provide: SolicitudHuespedService, useValue: solicitudesService },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { isAuthenticated$: authState$.asObservable() } }
      ]
    });

    service = TestBed.inject(GuestRequestNotificationService);
  });

  it('establece baseline sin mostrar Toasts y refleja pendientes', () => {
    solicitudesService.consultar.and.returnValue(of([request(20, '2'), request(21, '9')]));

    service.start();
    authState$.next(true);

    expect(service.cantidadPendientes()).toBe(2);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('notifica una solicitud nueva y no repite una conocida', fakeAsync(() => {
    solicitudesService.consultar.and.returnValues(
      of([request(20, '2')]),
      of([request(20, '2'), request(22, '5')]),
      of([request(22, '5')]),
      of([request(20, '2'), request(22, '5')])
    );

    service.start();
    authState$.next(true);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    tick();

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('Habitación 5 · Toallas adicionales', 6500, 'Nueva solicitud de huésped');
    expect(service.cantidadPendientes()).toBe(2);
    expect((service as unknown as { knownIds: Set<number> }).knownIds).toEqual(new Set([20, 22]));
  }));

  it('resume el estado válido cuando una consulta falla', fakeAsync(() => {
    solicitudesService.consultar.and.returnValues(
      of([request(30, '4')]),
      throwError(() => new Error('temporal')),
      of([request(30, '4'), request(31, '6')])
    );

    service.start();
    authState$.next(true);
    expect(service.cantidadPendientes()).toBe(1);

    window.dispatchEvent(new Event('focus'));
    expect(service.cantidadPendientes()).toBe(1);
    window.dispatchEvent(new Event('focus'));
    tick();

    expect(service.cantidadPendientes()).toBe(2);
  }));

  it('resume varias solicitudes nuevas en un solo Toast', () => {
    solicitudesService.consultar.and.returnValues(
      of([request(50, '1')]),
      of([request(50, '1'), request(51, '2'), request(52, '3')])
    );

    service.start();
    authState$.next(true);
    window.dispatchEvent(new Event('focus'));

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('Se recibieron 2 nuevas solicitudes.', 6500, 'Nuevas solicitudes de huéspedes');
  });

  it('resume el baseline al cerrar sesión y permite un nuevo ciclo al autenticarse', () => {
    solicitudesService.consultar.and.returnValues(of([request(40, '8')]), of([request(41, '10')]));

    service.start();
    authState$.next(true);
    authState$.next(false);
    expect(service.cantidadPendientes()).toBe(0);

    authState$.next(true);
    expect(service.cantidadPendientes()).toBe(1);
    expect(toast.info).not.toHaveBeenCalled();
  });
});
