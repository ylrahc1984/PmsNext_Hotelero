export type TourMode = 'demo' | 'pms';
export type TourBookingStatus = 'CONFIRMADA' | 'CANCELADA';
export type TourScheduleStatus = 'ACTIVO' | 'INACTIVO';
export type TourAvailability = 'available' | 'limited' | 'sold-out' | 'inactive';
export type TourBookingEventType = 'CREADA' | 'CAMBIO_HORARIO' | 'CANCELADA';
export interface TourGuide { id: string; name: string; languages: string[]; active: boolean; }
export interface TourActivity { id: string; name: string; description: string; image: string; active: boolean; defaultCapacity: number; supportedLanguages: string[]; }
export interface TourSchedule { id: string; activityId: string; date: string; startTime: string; endTime: string; capacity: number; guideIds: string[]; status: TourScheduleStatus; }
export interface TourBooking { id: string; mode: TourMode; activityId: string; scheduleId: string; date: string; hotelReservationCode: string; roomNumber: string; guestName: string; participants: number; language: string; status: TourBookingStatus; sourceReference: string; createdAt: string; updatedAt: string; }
export interface TourBookingEvent { id: string; bookingId: string; eventType: TourBookingEventType; description: string; timestamp: string; operator: string; }
export interface TourGuestRoom { id: string; mode: TourMode; roomNumber: string; guestName: string; reservationCode: string; adults: number; children: number; stayStatus: string; sourceReference: string; }
export interface TourScheduleView extends TourSchedule { activity: TourActivity; guides: TourGuide[]; reserved: number; available: number; availability: TourAvailability; }
export interface TourDemoState { schemaVersion: number; bookings: TourBooking[]; events: TourBookingEvent[]; }
export type TourOperationResult = { ok: true; booking?: TourBooking } | { ok: false; message: string };
