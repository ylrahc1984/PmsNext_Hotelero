import { CalendarReservation } from '../interfaces/calendar.interface';

export function isCheckedInCalendarReservation(reservation: CalendarReservation): boolean {
  return reservation.reservationState?.trim().toUpperCase() === 'CHK';
}
