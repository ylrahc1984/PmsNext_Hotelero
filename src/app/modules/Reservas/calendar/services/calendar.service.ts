import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { differenceInPmsCalendarDays, normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import { ROOMS_MOCK } from '../../mock-data/rooms.mock';
import { RoomHousekeepingStatus, RoomOperationalStatus, RoomStatus, RoomType } from '../../interfaces/room-status.interface';
import {
  CalendarData,
  CalendarDate,
  CalendarAssignableReservation,
  CalendarFilterStatus,
  CalendarQuery,
  CalendarRoomAssignmentRequest,
  CalendarRoomAssignmentResponse,
  CalendarReservation,
  CalendarReservationBlockView,
  CalendarRoomRowView
} from '../interfaces/calendar.interface';
import { CALENDAR_RESERVATIONS_MOCK } from '../mock/calendar.mock';

const CELL_WIDTH = 42;
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface CalendarApiInventoryRoom {
  numHab: number | string;
  cateHab?: string | null;
  tipoHab?: string | null;
  codGrp?: string | null;
  numPax?: number | null;
  totCamas?: number | null;
  descripcion?: string | null;
  estHab?: string | null;
  clean?: string | null;
  activo?: string | null;
}

interface CalendarApiDay {
  numHab: number | string;
  categoria?: string | null;
  codGrp?: string | null;
  habOrigen?: string | null;
  fecha: string;
  estado?: string | null;
  codReserva?: string | null;
  codigoPlan?: string | null;
  numPax?: number | null;
  numChild?: number | null;
  estadoReserva?: string | null;
  reservaDescripcion?: string | null;
  agenciaNombre?: string | null;
  fechaIngEvento?: string | null;
  fechaSalEvento?: string | null;
}

interface CalendarApiResponse {
  inventario?: CalendarApiInventoryRoom[];
  calendario?: CalendarApiDay[];
  respuesta?: string;
  totalHabitaciones?: number;
  totalDias?: number;
}

interface PrecheckingReservationApiItem {
  numHabita?: string | null;
  catHabita?: string | null;
  tipHabita?: string | null;
  codReserva?: string | null;
  descripcion?: string | null;
  fechaIng?: string | null;
  fechaSal?: string | null;
  estado?: string | null;
  numPax?: number | null;
  numChild?: number | null;
  orden?: number | null;
  habOrigen?: string | null;
  observacion?: string | null;
  nomAgencia?: string | null;
  codPlan?: string | null;
  totNoches?: number | null;
  codAgencia?: string | null;
  listaHabitaciones?: string | number | null;
  roomingList?: string | null;
}

interface PrecheckingReservationApiResponse {
  success?: boolean;
  data?: PrecheckingReservationApiItem[];
}

export interface CalendarApiDataSource {
  rooms: RoomStatus[];
  reservations: CalendarReservation[];
  typeOptions: RoomType[];
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/calendario-habitaciones`;
  private readonly precheckingUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/prechecking`;

  getCalendarApiData(startDate: string, endDate: string): Observable<CalendarApiDataSource> {
    const params = new HttpParams()
      .set('fechaInicio', this.toDisplayDate(startDate))
      .set('fechaFin', this.toDisplayDate(endDate))
      .set('soloActivas', 'true');

    return this.http
      .get<CalendarApiResponse>(this.apiUrl, { params })
      .pipe(map((response) => this.mapApiResponse(response)));
  }

  assignReservationRoom(request: CalendarRoomAssignmentRequest): Observable<CalendarRoomAssignmentResponse> {
    return this.http.put<CalendarRoomAssignmentResponse>(`${this.precheckingUrl}/asignar-habitacion`, {
      ...request,
      ...(request.fechaIngreso ? { fechaIngreso: normalizePmsDateDDMMYYYY(request.fechaIngreso) } : {}),
      ...(request.fechaSalida ? { fechaSalida: normalizePmsDateDDMMYYYY(request.fechaSalida) } : {})
    });
  }

  getPendingPrecheckingReservations(startDate: string, endDate: string): Observable<CalendarAssignableReservation[]> {
    const params = new HttpParams()
      .set('fechaIng', this.toDisplayDate(startDate))
      .set('fechaSal', this.toDisplayDate(endDate))
      .set('_ts', Date.now().toString());

    return this.http.get<PrecheckingReservationApiResponse>(`${this.precheckingUrl}/reservas`, { params }).pipe(
      map((response) => {
        const reservations = Array.isArray(response?.data) ? response.data : [];
        return reservations.map((reservation) => this.mapPrecheckingReservation(reservation, startDate, endDate));
      })
    );
  }

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

  getCalendarData(query: CalendarQuery, roomsSource?: RoomStatus[], reservationsSource?: CalendarReservation[]): CalendarData {
    const dates = this.buildDateRange(query.startDate, query.endDate);
    const rooms = this.filterRooms(roomsSource ?? this.getRooms(), query);
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

  getReservationBlockView(reservation: CalendarReservation, visibleStartDate: string, totalDays: number): CalendarReservationBlockView {
    return this.toBlockView(reservation, visibleStartDate, totalDays);
  }

  private mapApiResponse(response: CalendarApiResponse | null | undefined): CalendarApiDataSource {
    const inventory = Array.isArray(response?.inventario) ? response.inventario : [];
    const calendar = Array.isArray(response?.calendario) ? response.calendario : [];
    const rooms = inventory.map((room) => this.mapApiRoom(room, calendar)).sort((left, right) => this.compareRoomNumbers(left.roomNumber, right.roomNumber));
    const reservations = this.mapApiReservations(calendar);

    return {
      rooms,
      reservations,
      typeOptions: [...new Set(rooms.map((room) => room.type).filter(Boolean))].sort()
    };
  }

  private mapApiRoom(room: CalendarApiInventoryRoom, calendar: CalendarApiDay[]): RoomStatus {
    const roomNumber = this.cleanText(room.numHab);
    const todayIso = this.toIsoDate(new Date());
    const todayEvent = calendar.find((item) => this.cleanText(item.numHab) === roomNumber && this.toIsoDateValue(item.fecha) === todayIso);

    return {
      roomNumber,
      type: this.cleanText(room.cateHab || room.descripcion || room.tipoHab || todayEvent?.categoria || 'SIN CATEGORIA'),
      status: this.mapRoomStatus(todayEvent?.estado || room.estHab),
      housekeepingStatus: this.mapHousekeepingStatus(room.clean),
      floor: this.getRoomFloor(roomNumber),
      guestName: this.cleanText(todayEvent?.reservaDescripcion || todayEvent?.agenciaNombre) || undefined
    };
  }

  private mapApiReservations(calendar: CalendarApiDay[]): CalendarReservation[] {
    const byReservation = new Map<string, CalendarReservation>();

    calendar
      .filter((item) => !!this.cleanText(item.codReserva) || this.isOperationalBlock(item))
      .forEach((item) => {
        const roomNumber = this.cleanText(item.numHab);
        const reservationCode = this.cleanText(item.codReserva);
        const isOperationalBlock = !reservationCode && this.isOperationalBlock(item);
        const startDate = this.toIsoDateValue(item.fechaIngEvento || item.fecha);
        const endDate = this.toIsoDateValue(item.fechaSalEvento || this.shiftIsoDate(startDate, 1));
        const eventCode = reservationCode || 'BLOQUEO-OPERATIVO';
        const key = `${eventCode}|${roomNumber}|${startDate}|${endDate}`;

        if (byReservation.has(key)) {
          return;
        }

        const description = this.cleanText(item.reservaDescripcion);
        const agency = this.cleanText(item.agenciaNombre);

        byReservation.set(key, {
          id: key,
          reservationCode: reservationCode || undefined,
          isOperationalBlock,
          roomNumber,
          sourceRoom: this.cleanText(item.habOrigen),
          categoryCode: this.cleanText(item.categoria || item.codGrp),
          startDate,
          endDate,
          status: this.mapReservationStatus(item.estado, item.estadoReserva),
          reservationState: this.cleanText(item.estadoReserva),
          guestName: description || agency || (isOperationalBlock ? 'Bloqueo operativo' : reservationCode),
          source: isOperationalBlock ? 'Grupo operativo' : agency || this.cleanText(item.codigoPlan) || reservationCode
        });
      });

    return [...byReservation.values()].sort((left, right) => {
      if (left.roomNumber !== right.roomNumber) {
        return this.compareRoomNumbers(left.roomNumber, right.roomNumber);
      }

      return left.startDate.localeCompare(right.startDate);
    });
  }

  private mapPrecheckingReservation(
    reservation: PrecheckingReservationApiItem,
    fallbackStartDate: string,
    fallbackEndDate: string
  ): CalendarAssignableReservation {
    const reservationCode = this.cleanText(reservation.codReserva);
    const startDate = this.toIsoDateValue(this.cleanText(reservation.fechaIng)) || fallbackStartDate;
    const explicitEndDate = this.toIsoDateValue(this.cleanText(reservation.fechaSal));
    const nights = Math.max(Number(reservation.totNoches || this.diffDays(startDate, explicitEndDate || fallbackEndDate) || 1), 1);
    const endDate = explicitEndDate || this.shiftIsoDate(startDate, nights);
    const order = reservation.orden ?? 0;

    return {
      id: `${reservationCode || 'RESERVA'}|${order}|${startDate}`,
      reservationCode,
      categoryCode: this.cleanText(reservation.catHabita),
      sourceRoom: this.cleanText(reservation.habOrigen || reservation.numHabita),
      roomNumber: this.cleanText(reservation.numHabita),
      startDate,
      endDate,
      nights,
      rooms: Math.max(Number(reservation.listaHabitaciones || 1), 1),
      guestName: this.cleanText(reservation.descripcion || reservation.observacion || reservation.roomingList || reservationCode),
      agency: this.cleanText(reservation.nomAgencia || reservation.codAgencia || 'Directo'),
      status: this.cleanText(reservation.estado || 'ABI'),
      operator: '',
      pax: Number(reservation.numPax || 0),
      children: Number(reservation.numChild || 0)
    };
  }

  private filterRooms(rooms: RoomStatus[], query: CalendarQuery): RoomStatus[] {
    const search = query.search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch =
        !search ||
        room.roomNumber.toLowerCase().includes(search) ||
        room.type.toLowerCase().includes(search) ||
        (room.guestName ?? '').toLowerCase().includes(search);
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
    const visibleEndDate = this.shiftIsoDate(startDate, totalDays);
    const startIndex = Math.max(0, this.diffDays(startDate, reservation.startDate));
    const endIndex = Math.min(totalDays, this.diffDays(startDate, reservation.endDate));
    const span = Math.max(1, endIndex - startIndex);

    return {
      reservation,
      startIndex,
      span,
      left: startIndex * CELL_WIDTH + 2,
      width: Math.max(36, span * CELL_WIDTH - 4),
      continuesBefore: reservation.startDate < startDate,
      continuesAfter: reservation.endDate > visibleEndDate,
      colorIndex: this.getReservationColorIndex(reservation.id),
      label: reservation.guestName,
      tooltip: `${reservation.guestName} | ${reservation.status} | ${normalizePmsDateDDMMYYYY(reservation.startDate)} -> ${normalizePmsDateDDMMYYYY(reservation.endDate)} | ${reservation.source}`
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
    return differenceInPmsCalendarDays(startDate, endDate) ?? 0;
  }

  private getReservationColorIndex(reservationId: string): number {
    let hash = 0;

    for (let index = 0; index < reservationId.length; index += 1) {
      hash = (hash * 31 + reservationId.charCodeAt(index)) | 0;
    }

    return Math.abs(hash) % 8;
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toDisplayDate(isoDate: string): string {
    return normalizePmsDateDDMMYYYY(isoDate);
  }

  private toIsoDateValue(value: string): string {
    return toPmsDateInputValue(value);
  }

  private shiftIsoDate(baseIsoDate: string, offset: number): string {
    const date = this.parseDate(baseIsoDate);
    date.setDate(date.getDate() + offset);
    return this.toIsoDate(date);
  }

  private cleanText(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private mapRoomStatus(status: string | null | undefined): RoomOperationalStatus {
    switch (this.cleanText(status).toUpperCase()) {
      case 'O':
      case 'OCUPADA':
      case 'OCUPADO':
        return 'OCUPADA';
      case 'B':
      case 'BLOQUEADA':
      case 'BLOQUEADO':
        return 'BLOQUEADA';
      case 'R':
      case 'RESERVADA':
      case 'RESERVADO':
        return 'RESERVADA';
      default:
        return 'DISPONIBLE';
    }
  }

  private mapHousekeepingStatus(status: string | null | undefined): RoomHousekeepingStatus {
    switch (this.cleanText(status).toUpperCase()) {
      case 'S':
      case 'SUCIA':
        return 'SUCIA';
      case 'I':
      case 'INSPECCION':
        return 'INSPECCION';
      default:
        return 'LIMPIA';
    }
  }

  private mapReservationStatus(status: string | null | undefined, reservationStatus: string | null | undefined): CalendarReservation['status'] {
    const normalizedStatus = this.cleanText(status).toUpperCase();
    const normalizedReservationStatus = this.cleanText(reservationStatus).toUpperCase();

    if (normalizedStatus.includes('BLOQUE') || normalizedReservationStatus === 'BLQ') {
      return 'BLOQUEADA';
    }

    if (normalizedStatus.includes('OCUP') || normalizedReservationStatus === 'CHK') {
      return 'OCUPADA';
    }

    return 'RESERVADA';
  }

  private isOperationalBlock(item: CalendarApiDay): boolean {
    return !this.cleanText(item.codReserva) && this.cleanText(item.estado).toUpperCase().includes('BLOQUE');
  }

  private getRoomFloor(roomNumber: string): number {
    const numericRoom = Number(roomNumber);

    if (!Number.isFinite(numericRoom) || numericRoom <= 0) {
      return 0;
    }

    return Math.floor(numericRoom / 100) || 1;
  }

  private compareRoomNumbers(left: string, right: string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right);
  }
}
