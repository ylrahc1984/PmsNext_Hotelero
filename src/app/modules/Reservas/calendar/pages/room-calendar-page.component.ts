import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { RoomType } from '../../interfaces/room-status.interface';
import { CalendarGridComponent } from '../components/calendar-grid/calendar-grid.component';
import { CalendarHeaderComponent } from '../components/calendar-header/calendar-header.component';
import { CalendarToolbarComponent } from '../components/calendar-toolbar/calendar-toolbar.component';
import { RoomSidebarComponent } from '../components/room-sidebar/room-sidebar.component';
import {
  CalendarData,
  CalendarFilterStatus,
  CalendarReservation,
  CalendarReservationBlockView,
  CalendarReservationDropRequest
} from '../interfaces/calendar.interface';
import { CalendarService } from '../services/calendar.service';

@Component({
  selector: 'app-room-calendar-page',
  standalone: true,
  imports: [CommonModule, CalendarToolbarComponent, RoomSidebarComponent, CalendarHeaderComponent, CalendarGridComponent],
  templateUrl: './room-calendar-page.component.html',
  styleUrls: ['./room-calendar-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomCalendarPageComponent implements AfterViewInit {
  private readonly calendarService = inject(CalendarService);
  private readonly router = inject(Router);

  @ViewChild(RoomSidebarComponent) roomSidebar?: RoomSidebarComponent;
  @ViewChild(CalendarGridComponent) calendarGrid?: CalendarGridComponent;

  readonly typeOptions: RoomType[] = ['STD', 'JUNIOR', 'DELUXE', 'SUITE'];
  readonly statusOptions: Array<{ label: string; value: CalendarFilterStatus }> = [
    { label: 'Todos', value: null },
    { label: 'Disponible', value: 'DISPONIBLE' },
    { label: 'Ocupado', value: 'OCUPADA' },
    { label: 'Reservado', value: 'RESERVADA' },
    { label: 'Bloqueado', value: 'BLOQUEADA' }
  ];

  startDate = this.toIsoDate(new Date());
  endDate = this.shiftDate(this.startDate, 29);
  search = '';
  type: RoomType | null = null;
  status: CalendarFilterStatus = null;
  headerScrollLeft = 0;
  private workingReservations: CalendarReservation[] = this.calendarService.getReservations();
  calendarData: CalendarData = this.calendarService.getCalendarData(this.buildQuery(), this.workingReservations);

  ngAfterViewInit(): void {
    this.reloadCalendar();
  }

  onStartDateChange(value: string): void {
    this.startDate = value;
    if (this.startDate > this.endDate) {
      this.endDate = this.startDate;
    }
    this.reloadCalendar();
  }

  onEndDateChange(value: string): void {
    this.endDate = value;
    if (this.endDate < this.startDate) {
      this.startDate = this.endDate;
    }
    this.reloadCalendar();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.reloadCalendar();
  }

  onTypeChange(value: RoomType | null): void {
    this.type = value;
    this.reloadCalendar();
  }

  onStatusChange(value: CalendarFilterStatus): void {
    this.status = value;
    this.reloadCalendar();
  }

  goToday(): void {
    const range = this.rangeLength;
    this.startDate = this.toIsoDate(new Date());
    this.endDate = this.shiftDate(this.startDate, range - 1);
    this.reloadCalendar(true);
  }

  shiftWindow(direction: -1 | 1): void {
    const range = this.rangeLength;
    this.startDate = this.shiftDate(this.startDate, range * direction);
    this.endDate = this.shiftDate(this.endDate, range * direction);
    this.reloadCalendar(true);
  }

  onGridScrollLeft(scrollLeft: number): void {
    this.headerScrollLeft = scrollLeft;
  }

  onGridScrollTop(scrollTop: number): void {
    this.roomSidebar?.setScrollTop(scrollTop);
  }

  onSidebarScrollTop(scrollTop: number): void {
    this.calendarGrid?.setScrollTop(scrollTop);
  }

  openReservation(block: CalendarReservationBlockView): void {
    void this.router.navigate(['/frontdesk/room', block.reservation.roomNumber]);
  }

  onReservationDrop(drop: CalendarReservationDropRequest): void {
    const current = this.workingReservations.find((reservation) => reservation.id === drop.reservationId);
    if (!current) {
      return;
    }

    const span = this.diffDays(current.startDate, current.endDate);
    const nextStartDate = drop.targetDate;
    const nextEndDate = this.shiftDate(nextStartDate, span);

    this.workingReservations = this.workingReservations.map((reservation) =>
      reservation.id === drop.reservationId
        ? {
            ...reservation,
            roomNumber: drop.toRoomNumber,
            startDate: nextStartDate,
            endDate: nextEndDate
          }
        : reservation
    );

    this.reloadCalendar();
  }

  get visibleWindowLabel(): string {
    return `${this.startDate} - ${this.endDate}`;
  }

  private reloadCalendar(resetScroll = false): void {
    this.calendarData = this.calendarService.getCalendarData(this.buildQuery(), this.workingReservations);
    if (resetScroll) {
      this.headerScrollLeft = 0;
      this.calendarGrid?.resetScroll();
      this.roomSidebar?.resetScroll();
    }
  }

  private buildQuery() {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      search: this.search,
      type: this.type,
      status: this.status
    };
  }

  private get rangeLength(): number {
    const start = new Date(`${this.startDate}T00:00:00`).getTime();
    const end = new Date(`${this.endDate}T00:00:00`).getTime();
    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
  }

  private shiftDate(baseIsoDate: string, offset: number): string {
    const date = new Date(`${baseIsoDate}T00:00:00`);
    date.setDate(date.getDate() + offset);
    return this.toIsoDate(date);
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private diffDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    return Math.max(1, Math.floor((end - start) / 86400000));
  }
}
