import { differenceInPmsCalendarDays } from 'src/app/core/utils/pms-date.util';

export type RoomOperationalVisualState =
  | 'available'
  | 'arrival-today'
  | 'occupied'
  | 'checkout-tomorrow'
  | 'checkout-today'
  | 'blocked'
  | 'future-reservation'
  | 'attention';

export const ROOM_OPERATIONAL_STATE_LABELS: Record<RoomOperationalVisualState, string> = {
  available: 'Disponible',
  'arrival-today': 'Entrada hoy',
  occupied: 'Ocupada',
  'checkout-tomorrow': 'Salida mañana',
  'checkout-today': 'Salida hoy',
  blocked: 'Bloqueada',
  'future-reservation': 'Reserva futura',
  attention: 'Requiere atención'
};

export interface ReservationOperationalStateInput {
  startDate: string;
  endDate: string;
  operationalDate: string;
  reservationStatus?: string | null;
  reservationState?: string | null;
  isOperationalBlock?: boolean;
}

export function resolveRackOperationalState(statusCode: string | null | undefined): RoomOperationalVisualState {
  const status = normalize(statusCode);
  const states: Record<string, RoomOperationalVisualState> = {
    B: 'blocked',
    D: 'available',
    H: 'checkout-today',
    M: 'checkout-tomorrow',
    O: 'occupied',
    R: 'arrival-today'
  };

  return states[status] ?? 'attention';
}

export function resolveReservationOperationalState(input: ReservationOperationalStateInput): RoomOperationalVisualState {
  const status = normalize(input.reservationStatus);
  const reservationState = normalize(input.reservationState);

  if (input.isOperationalBlock || status === 'BLOQUEADA' || status === 'B' || status.includes('BLOQUE')) {
    return 'blocked';
  }

  const daysToArrival = differenceInPmsCalendarDays(input.operationalDate, input.startDate);
  const daysToDeparture = differenceInPmsCalendarDays(input.operationalDate, input.endDate);
  if (daysToArrival === null || daysToDeparture === null) {
    return 'attention';
  }
  if (daysToDeparture <= daysToArrival) {
    return 'attention';
  }

  const isCheckedIn =
    reservationState === 'CHK' ||
    status === 'OCUPADA' ||
    status === 'O' ||
    status === 'H' ||
    status === 'M' ||
    status.includes('OCUP');

  if (isCheckedIn) {
    if (daysToArrival > 0) {
      return 'attention';
    }
    if (daysToDeparture === 0) {
      return 'checkout-today';
    }
    if (daysToDeparture === 1) {
      return 'checkout-tomorrow';
    }
    return daysToDeparture > 1 ? 'occupied' : 'attention';
  }

  if (daysToArrival === 0) {
    return 'arrival-today';
  }
  if (daysToArrival > 0) {
    return 'future-reservation';
  }
  if (daysToDeparture === 0) {
    return 'checkout-today';
  }

  return 'attention';
}

export function getRoomOperationalStateLabel(state: RoomOperationalVisualState): string {
  return ROOM_OPERATIONAL_STATE_LABELS[state];
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toString().trim().toUpperCase();
}
