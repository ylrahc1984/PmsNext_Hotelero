import { Injectable } from '@angular/core';

import { ROOMS_MOCK } from '../../mock-data/rooms.mock';
import { RoomStatus } from '../../interfaces/room-status.interface';
import {
  CalendarData,
  CalendarDate,
  CalendarFilterStatus,
  CalendarQuery,
  CalendarReservation,
  CalendarReservationBlockView,
  CalendarRoomRowView
} from '../interfaces/calendar.interface';
import { CALENDAR_RESERVATIONS_MOCK } from '../mock/calendar.mock';

const CELL_WIDTH = 42;
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Injectable({ providedIn: 'root' })
export class CalendarService {
  getRooms(): RoomStatus[] {
    return [...ROOMS_MOCK].sort((left, right) => left.roomNumber.localeCompare(right.roomNumber));
  }

  getReservations(): CalendarReservation[] {
    return [...CALENDAR_RESERVATIONS_MOCK].sort((left, right) => {
      if (left.roomNumber !== right.roomNumber) {
        return left.roomNumber.localeCompare(right.roomNumber);
      }

      return left.startDate.localeCompare(right.startDate);
    });
  }

  getCalendarData(query: CalendarQuery, reservationsSource?: CalendarReservation[]): CalendarData {
    const dates = this.buildDateRange(query.startDate, query.endDate);
    const rooms = this.filterRooms(this.getRooms(), query);
    const reservations = (reservationsSource ?? this.getReservations()).slice().sort((left, right) => {
      if (left.roomNumber !== right.roomNumber) {
        return left.roomNumber.localeCompare(right.roomNumber);
      }

      return left.startDate.localeCompare(right.startDate);
    });

    const rows = rooms
      .map((room) => this.buildRoomRow(room, dates, reservations))
      .filter((row) => this.matchesStatusFilter(row, query.status));

    return {
      monthLabel: this.buildMonthLabel(dates),
      dates,
      rows,
      visibleRooms: rows.length,
      visibleReservations: rows.reduce((sum, row) => sum + row.blocks.length, 0)
    };
  }

  private filterRooms(rooms: RoomStatus[], query: CalendarQuery): RoomStatus[] {
    const search = query.search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch = !search || room.roomNumber.toLowerCase().includes(search);
      const matchesType = !query.type || room.type === query.type;
      return matchesSearch && matchesType;
    });
  }

  private buildRoomRow(room: RoomStatus, dates: CalendarDate[], reservations: CalendarReservation[]): CalendarRoomRowView {
    const visibleReservations = reservations
      .filter((reservation) => reservation.roomNumber === room.roomNumber)
      .filter((reservation) => this.overlapsRange(reservation, dates[0]?.isoDate, dates[dates.length - 1]?.isoDate))
      .map((reservation) => this.toBlockView(reservation, dates[0].isoDate, dates.length))
      .sort((left, right) => left.startIndex - right.startIndex);

    return {
      room,
      blocks: visibleReservations,
      isAvailable: visibleReservations.length === 0
    };
  }

  private matchesStatusFilter(row: CalendarRoomRowView, status: CalendarFilterStatus): boolean {
    if (!status) {
      return true;
    }

    if (status === 'DISPONIBLE') {
      return row.isAvailable;
    }

    return row.blocks.some((block) => block.reservation.status === status);
  }

  private toBlockView(reservation: CalendarReservation, startDate: string, totalDays: number): CalendarReservationBlockView {
    const startIndex = Math.max(0, this.diffDays(startDate, reservation.startDate));
    const endIndex = Math.min(totalDays, this.diffDays(startDate, reservation.endDate));
    const span = Math.max(1, endIndex - startIndex);
    const label = this.abbreviateName(reservation.guestName);

    return {
      reservation,
      startIndex,
      span,
      left: startIndex * CELL_WIDTH + 2,
      width: Math.max(36, span * CELL_WIDTH - 4),
      label,
      tooltip: `${reservation.guestName} | ${reservation.status} | ${reservation.startDate} -> ${reservation.endDate} | ${reservation.source}`
    };
  }

  private buildDateRange(startDate: string, endDate: string): CalendarDate[] {
    const dates: CalendarDate[] = [];
    const cursor = this.parseDate(startDate);
    const finalDate = this.parseDate(endDate);
    const todayIso = this.toIsoDate(new Date());

    while (cursor <= finalDate) {
      const isoDate = this.toIsoDate(cursor);
      const day = cursor.getDay();

      dates.push({
        isoDate,
        dayNumber: cursor.getDate(),
        dayNameShort: DAY_NAMES[day],
        monthShort: MONTH_NAMES[cursor.getMonth()],
        isToday: isoDate === todayIso,
        isWeekend: day === 0 || day === 6
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private buildMonthLabel(dates: CalendarDate[]): string {
    if (!dates.length) {
      return '';
    }

    const first = this.parseDate(dates[0].isoDate);
    const last = this.parseDate(dates[dates.length - 1].isoDate);

    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
    }

    return `${MONTH_NAMES[first.getMonth()]} - ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
  }

  private overlapsRange(reservation: CalendarReservation, startDate?: string, endDate?: string): boolean {
    if (!startDate || !endDate) {
      return false;
    }

    return reservation.startDate <= endDate && reservation.endDate > startDate;
  }

  private diffDays(startDate: string, endDate: string): number {
    const start = this.parseDate(startDate).getTime();
    const end = this.parseDate(endDate).getTime();
    return Math.floor((end - start) / 86400000);
  }

  private abbreviateName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0];
    }

    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T00:00:00`);
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
