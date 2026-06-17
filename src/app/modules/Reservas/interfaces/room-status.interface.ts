export type RoomType = 'STD' | 'JUNIOR' | 'DELUXE' | 'SUITE';
export type RoomHousekeepingStatus = 'LIMPIA' | 'SUCIA' | 'INSPECCION';
export type RoomOperationalStatus = 'DISPONIBLE' | 'OCUPADA' | 'RESERVADA' | 'BLOQUEADA';

export interface RoomStatus {
  roomNumber: string;
  type: RoomType;
  status: RoomOperationalStatus;
  housekeepingStatus: RoomHousekeepingStatus;
  floor: number;
  guestName?: string;
}
