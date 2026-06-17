import { RoomStatus, RoomType } from '../../interfaces/room-status.interface';

export type CalendarReservationStatus = 'OCUPADA' | 'RESERVADA' | 'BLOQUEADA';
export type CalendarFilterStatus = CalendarReservationStatus | 'DISPONIBLE' | null;

export interface CalendarReservation {
  id: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  status: CalendarReservationStatus;
  guestName: string;
  source: string;
}

export interface CalendarDate {
  isoDate: string;
  dayNumber: number;
  dayNameShort: string;
  monthShort: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarQuery {
  startDate: string;
  endDate: string;
  search: string;
  type: RoomType | null;
  status: CalendarFilterStatus;
}

export interface CalendarReservationBlockView {
  reservation: CalendarReservation;
  startIndex: number;
  span: number;
  left: number;
  width: number;
  label: string;
  tooltip: string;
}

export interface CalendarReservationDragPayload {
  reservationId: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  status: CalendarReservationStatus;
}

export interface CalendarDropTarget {
  roomNumber: string;
  targetDate: string;
}

export interface CalendarReservationDropRequest {
  reservationId: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  targetDate: string;
}

export interface CalendarRoomRowView {
  room: RoomStatus;
  blocks: CalendarReservationBlockView[];
  isAvailable: boolean;
}

export interface CalendarData {
  monthLabel: string;
  dates: CalendarDate[];
  rows: CalendarRoomRowView[];
  visibleRooms: number;
  visibleReservations: number;
}
