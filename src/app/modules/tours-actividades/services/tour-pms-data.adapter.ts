import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { InHouseGuestsService } from 'src/app/modules/front-desk/in-house-guests/services/in-house-guests.service';
import { InHouseGuest } from 'src/app/modules/front-desk/in-house-guests/models/in-house-guest.model';
import { RoomRackRoom } from 'src/app/modules/front-desk/pages/room-rack/models/room-rack-room.model';
import { RoomRackService } from 'src/app/modules/front-desk/pages/room-rack/services/room-rack.service';
import { TourGuestRoom } from '../models/tour-demo.models';
@Injectable({ providedIn: 'root' })
export class TourPmsDataAdapter {
  private readonly roomRack = inject(RoomRackService);
  private readonly inHouse = inject(InHouseGuestsService);
  getGuestRooms(date: string, operator: string): Observable<TourGuestRoom[]> { return forkJoin({ rooms: this.roomRack.getAllRoomsStatus(date), guests: this.inHouse.getInHouseGuests(date, date, operator) }).pipe(map(({ rooms, guests }) => this.mapRooms(rooms, guests.pax ?? []))); }
  private mapRooms(rooms: RoomRackRoom[], guests: InHouseGuest[]): TourGuestRoom[] {
    const guestsByRoom = new Map<string, InHouseGuest>();
    guests.forEach((guest) => guestsByRoom.set(this.normalize(guest.numHabita), guest));
    return rooms.filter((room) => this.normalize(room.CR05_Activo) !== 'N').map((room) => {
      const roomNumber = this.normalize(room.CR05_NumHab); const guest = guestsByRoom.get(roomNumber); const total = Number(guest?.numPax ?? room.CR05_NumPax ?? 0); const reservationCode = guest?.codReserva?.trim() || room.RSV?.trim() || 'Sin código';
      return { id: `pms-room-${roomNumber}`, mode: 'pms' as const, roomNumber, guestName: guest?.paxIn?.trim() || 'Huésped PMS', reservationCode, adults: Number(guest?.numPax ?? total), children: Number(guest?.numChild ?? 0), stayStatus: this.mapStatus(room.CR05_EstHab), sourceReference: `${roomNumber}|${reservationCode}` };
    }).filter((room) => room.reservationCode !== 'Sin código');
  }
  private mapStatus(status: string): string { return ({ O: 'Ocupada', R: 'Reservada', D: 'Disponible', B: 'Bloqueada', H: 'Ocupada' } as Record<string, string>)[this.normalize(status)] || 'Estado PMS'; }
  private normalize(value: unknown): string { return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase(); }
}
