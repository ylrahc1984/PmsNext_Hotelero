import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { TourGuestRoom } from '../models/tour-demo.models';
import { TourDemoService } from './tour-demo.service';
import { TourPmsDataAdapter } from './tour-pms-data.adapter';

class FakePmsAdapter {
  fail = false;
  getGuestRooms(): Observable<TourGuestRoom[]> { return this.fail ? throwError(() => new Error('PMS no disponible')) : of([{ id: 'pms-1', mode: 'pms', roomNumber: '901', guestName: 'Huésped PMS', reservationCode: 'PMS-1', adults: 2, children: 0, stayStatus: 'Ocupada', sourceReference: '901|PMS-1' }]); }
}

describe('TourDemoService', () => {
  let service: TourDemoService;
  let pms: FakePmsAdapter;
  const today = (): string => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

  beforeEach(() => {
    localStorage.clear();
    pms = new FakePmsAdapter();
    TestBed.configureTestingModule({
      providers: [
        TourDemoService,
        { provide: TourPmsDataAdapter, useValue: pms },
        { provide: AuthService, useValue: { getCurrentUser: () => ({ usuario: 'TEST' }) } }
      ]
    });
    service = TestBed.inject(TourDemoService);
    service.setMode('demo');
  });

  it('reserva participantes y calcula cupos desde el mismo estado', () => {
    const schedule = service.getSchedules(today()).find((item) => item.id.includes('canopy') && item.startTime === '13:00')!;
    const room = service.getRooms()[5];
    const before = schedule.available;
    expect(service.reserve({ room, schedule, participants: 2, language: 'Español' }).ok).toBeTrue();
    expect(service.getSchedules(today()).find((item) => item.id === schedule.id)!.available).toBe(before - 2);
  });

  it('rechaza sobreventa sin cambiar el cupo', () => {
    const schedule = service.getSchedules(today()).find((item) => item.startTime === '18:00')!;
    const before = schedule.available;
    const result = service.reserve({ room: service.getRooms()[0], schedule, participants: before + 1, language: 'Español' });
    expect(result.ok).toBeFalse();
    expect(service.getSchedules(today()).find((item) => item.id === schedule.id)!.available).toBe(before);
  });

  it('cancela sin borrar la reserva y libera sus participantes', () => {
    const schedule = service.getSchedules(today()).find((item) => item.startTime === '10:00')!;
    const booking = service.getBookings(schedule.id)[0];
    const before = schedule.available;
    service.cancel(booking, 'Cambio de planes');
    expect(service.getBookings(schedule.id).find((item) => item.id === booking.id)?.status).toBe('CANCELADA');
    expect(service.getSchedules(today()).find((item) => item.id === schedule.id)!.available).toBe(before + booking.participants);
  });

  it('mueve una reserva de forma atómica', () => {
    const origin = service.getSchedules(today()).find((item) => item.startTime === '10:00')!;
    const destination = service.getSchedules(today()).find((item) => item.startTime === '13:00')!;
    const booking = service.getBookings(origin.id)[1];
    const result = service.move(booking, destination);
    expect(result.ok).toBeTrue();
    expect(service.getBookings(origin.id).some((item) => item.id === booking.id)).toBeFalse();
    expect(service.getBookings(destination.id).some((item) => item.id === booking.id)).toBeTrue();
  });

  it('separa modo PMS y Demo y tolera PMS no disponible', () => {
    expect(service.getRooms()[0].mode).toBe('demo');
    service.setMode('pms');
    expect(service.getRooms()[0].mode).toBe('pms');
    pms.fail = true;
    service.loadPmsRooms();
    expect(service.pmsError()).toContain('No fue posible');
    expect(service.getRooms()).toEqual([]);
  });

  it('persiste reservas simuladas sin nombres reales cuando el modo es PMS', () => {
    service.setMode('pms');
    const room = { id: 'pms-1', mode: 'pms' as const, roomNumber: '901', guestName: 'Huésped PMS', reservationCode: 'PMS-1', adults: 2, children: 0, stayStatus: 'Ocupada', sourceReference: '901|PMS-1' };
    const schedule = service.getSchedules(today()).find((item) => item.startTime === '13:00')!;
    service.reserve({ room, schedule, participants: 1, language: 'Español' });
    expect(localStorage.getItem('pmsnext.tours-actividades.demo.v1')).not.toContain('Huésped real');
    expect(localStorage.getItem('pmsnext.tours-actividades.demo.v1')).toContain('PMS-1');
  });

  it('reinicia el escenario demo y sus eventos', () => {
    service.resetDemo();
    const initial = service.getBookings(service.getSchedules(today())[0].id).length;
    service.cancel(service.getBookings(service.getSchedules(today()).find((item) => item.startTime === '10:00')!.id)[0], 'Prueba');
    service.resetDemo();
    expect(service.events().length).toBe(0);
    expect(service.getBookings(service.getSchedules(today()).find((item) => item.startTime === '10:00')!.id).length).toBeGreaterThanOrEqual(initial);
  });
});
