import { RoomStatus, RoomType } from '../../interfaces/room-status.interface';
import { RoomOperationalVisualState } from 'src/app/shared/models/room-operational-visual-state';

export type CalendarReservationStatus = 'OCUPADA' | 'RESERVADA' | 'BLOQUEADA';
export type CalendarFilterStatus = RoomOperationalVisualState | null;

export interface CalendarReservation {
  id: string;
  reservationCode?: string;
  isOperationalBlock?: boolean;
  roomNumber: string;
  sourceRoom?: string;
  categoryCode?: string;
  startDate: string;
  endDate: string;
  status: CalendarReservationStatus;
  reservationState?: string;
  guestName: string;
  source: string;
}

export interface CalendarAssignableReservation {
  id: string;
  reservationCode: string;
  categoryCode: string;
  sourceRoom: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  nights: number;
  rooms: number;
  guestName: string;
  agency: string;
  status: string;
  operator: string;
  pax: number;
  children: number;
}

export interface CalendarAssignmentTarget {
  roomNumber: string;
  categoryCode: string;
  targetDate: string;
  valid: boolean;
}

export interface CalendarRoomAssignmentRequest {
  codReserva: string;
  oldHabita: string;
  newHabita: string;
  categoria: string;
  operador: string;
  fechaIngreso?: string;
  fechaSalida?: string;
}

export interface CalendarRoomAssignmentResponse {
  ok?: boolean;
  success?: boolean;
  respuesta?: string;
  mensaje?: string;
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
  continuesBefore: boolean;
  continuesAfter: boolean;
  isPastDeparture: boolean;
  visualState: RoomOperationalVisualState;
  label: string;
  tooltip: string;
}

export type RoomExchangeChangeStatus = 'in-tray' | 'assigned' | 'restored';

export interface ExchangeTrayReservation {
  reservation: CalendarReservation;
  originalRoomNumber: string;
  backendSourceRoom: string;
  currentRoomNumber: string | null;
  status: RoomExchangeChangeStatus;
  lane: number;
  block: CalendarReservationBlockView;
}

export interface RoomExchangeChange {
  reservationId: string;
  reservation: CalendarReservation;
  originalRoomNumber: string;
  backendSourceRoom: string;
  newRoomNumber: string | null;
  status: RoomExchangeChangeStatus;
}

export interface CalendarExchangeTrayAssignmentRequest {
  reservationId: string;
  toRoomNumber: string;
  toCategoryCode: string;
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
  fromRoomNumber: string | null;
  toRoomNumber: string;
  toCategoryCode: string;
  targetDate: string;
  pendingReservation?: CalendarAssignableReservation;
}

export interface CalendarReservationBlockSelect {
  block: CalendarReservationBlockView;
  event: MouseEvent;
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
