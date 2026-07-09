import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { RoomStatus, RoomType } from '../../interfaces/room-status.interface';
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
export class RoomCalendarPageComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild(RoomSidebarComponent) roomSidebar?: RoomSidebarComponent;
  @ViewChild(CalendarGridComponent) calendarGrid?: CalendarGridComponent;

  typeOptions: RoomType[] = [];
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
  isLoading = false;
  errorMessage = '';
  private rooms: RoomStatus[] = [];
  private workingReservations: CalendarReservation[] = [];
  calendarData: CalendarData = this.calendarService.getCalendarData(this.buildQuery(), this.rooms, this.workingReservations);

  ngOnInit(): void {
    this.loadCalendar(true);
  }

  onStartDateChange(value: string): void {
    this.startDate = value;
    if (this.startDate > this.endDate) {
      this.endDate = this.startDate;
    }
    this.loadCalendar();
  }

  onEndDateChange(value: string): void {
    this.endDate = value;
    if (this.endDate < this.startDate) {
      this.startDate = this.endDate;
    }
    this.loadCalendar();
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
    this.loadCalendar(true);
  }

  shiftWindow(direction: -1 | 1): void {
    const range = this.rangeLength;
    this.startDate = this.shiftDate(this.startDate, range * direction);
    this.endDate = this.shiftDate(this.endDate, range * direction);
    this.loadCalendar(true);
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
    console.info('[RoomCalendar] Drag/drop pendiente de integracion backend.', drop);
  }

  get visibleWindowLabel(): string {
    return `${this.startDate} - ${this.endDate}`;
  }

  private reloadCalendar(resetScroll = false): void {
    this.calendarData = this.calendarService.getCalendarData(this.buildQuery(), this.rooms, this.workingReservations);
    if (resetScroll) {
      this.headerScrollLeft = 0;
      this.calendarGrid?.resetScroll();
      this.roomSidebar?.resetScroll();
    }
  }

  private loadCalendar(resetScroll = false): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.calendarService
      .getCalendarApiData(this.startDate, this.endDate)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el calendario de habitaciones.', error);
          this.errorMessage = 'No se pudo cargar el calendario de habitaciones.';
          return of({ rooms: [] as RoomStatus[], reservations: [] as CalendarReservation[], typeOptions: [] as RoomType[] });
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.rooms = data.rooms;
        this.workingReservations = data.reservations;
        this.typeOptions = data.typeOptions;

        if (this.type && !this.typeOptions.includes(this.type)) {
          this.type = null;
        }

        this.reloadCalendar(resetScroll);
      });
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
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private diffDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    return Math.max(1, Math.floor((end - start) / 86400000));
  }
}
