import { ROOMS_MOCK } from '../../mock-data/rooms.mock';
import { CalendarReservation, CalendarReservationStatus } from '../interfaces/calendar.interface';

const GUESTS = [
  'Maria Rodriguez',
  'Alberto Perez',
  'Lucia Solano',
  'Carlos Brenes',
  'Sofia Marquez',
  'Javier Arias',
  'Rosa Chacon',
  'Elena Vargas',
  'Daniel Herrera',
  'Paola Granados',
  'Tomas Acosta',
  'Nadia Molina'
];

const SOURCES = ['Directa', 'Booking Plus', 'TravelHub', 'Skyline DMC', 'OrbitNet'];
const STATUS_SEQUENCE: CalendarReservationStatus[] = ['OCUPADA', 'RESERVADA', 'BLOQUEADA', 'RESERVADA', 'OCUPADA'];

function toIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export const CALENDAR_RESERVATIONS_MOCK: CalendarReservation[] = ROOMS_MOCK.flatMap((room, index) => {
  if (index % 7 === 0) {
    return [];
  }

  const reservations: CalendarReservation[] = [];
  const targetBlocks = room.type === 'SUITE' ? 3 : room.type === 'DELUXE' ? 2 : room.type === 'JUNIOR' ? 2 : 1 + (index % 2);
  let cursor = index % 5;

  for (let blockIndex = 0; blockIndex < targetBlocks; blockIndex += 1) {
    cursor += blockIndex === 0 ? index % 3 : (index + blockIndex) % 4;

    if (cursor >= 29) {
      break;
    }

    const baseDuration = room.type === 'SUITE' ? 4 : room.type === 'DELUXE' ? 3 : 2;
    const duration = baseDuration + ((index + blockIndex) % 3);
    const startOffset = cursor;
    const endOffset = Math.min(30, startOffset + duration);
    let status = STATUS_SEQUENCE[(index + blockIndex) % STATUS_SEQUENCE.length];

    if (blockIndex === 0 && room.status === 'BLOQUEADA') {
      status = 'BLOQUEADA';
    }

    reservations.push({
      id: `${room.roomNumber}-${blockIndex + 1}`,
      roomNumber: room.roomNumber,
      startDate: toIsoDate(startOffset),
      endDate: toIsoDate(endOffset),
      status,
      guestName: blockIndex === 0 && room.guestName ? room.guestName.replace('.', '') : GUESTS[(index + blockIndex) % GUESTS.length],
      source: SOURCES[(index + blockIndex) % SOURCES.length]
    });

    cursor = endOffset + ((index + blockIndex) % 2);
  }

  return reservations;
});
