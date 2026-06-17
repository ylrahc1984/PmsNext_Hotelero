import { RoomStatus, RoomType } from '../interfaces/room-status.interface';

const ROOM_TYPES: RoomType[] = ['STD', 'JUNIOR', 'DELUXE', 'SUITE'];
const GUESTS = ['Maria R.', 'Alberto P.', 'Lucia S.', 'Carlos B.', 'Sofia M.', 'Javier A.'];

export const ROOMS_MOCK: RoomStatus[] = Array.from({ length: 7 }, (_, floor) => floor + 1).flatMap((floor) =>
  Array.from({ length: 12 }, (_, index) => {
    const roomNumber = `${floor}${String(index + 1).padStart(2, '0')}`;
    const mix = floor * 12 + index;
    const status = mix % 11 === 0 ? 'BLOQUEADA' : mix % 4 === 0 ? 'OCUPADA' : mix % 5 === 0 ? 'RESERVADA' : 'DISPONIBLE';

    return {
      roomNumber,
      type: ROOM_TYPES[mix % ROOM_TYPES.length],
      status,
      housekeepingStatus: mix % 6 === 0 ? 'SUCIA' : mix % 7 === 0 ? 'INSPECCION' : 'LIMPIA',
      floor,
      guestName: status === 'OCUPADA' ? GUESTS[mix % GUESTS.length] : undefined
    };
  })
);
