import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { CalendarAssignableReservation } from '../../interfaces/calendar.interface';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-reservation-assignment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservation-assignment-panel.component.html',
  styleUrls: ['./reservation-assignment-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationAssignmentPanelComponent implements OnChanges {
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) startDate!: string;
  @Input({ required: true }) endDate!: string;
  @Input() collapsed = false;
  @Input() assignedReservationIds: string[] = [];
  @Input() selectedReservationId: string | null = null;

  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() reservationSelect = new EventEmitter<CalendarAssignableReservation>();
  @Output() dragStart = new EventEmitter<{ reservation: CalendarAssignableReservation; event: PointerEvent }>();
  @Output() refresh = new EventEmitter<void>();

  search = '';
  status = '';
  isLoading = false;
  usingDemoData = false;
  reservations: CalendarAssignableReservation[] = [];

  readonly statusOptions = [
    { label: 'Todas', value: '' },
    { label: 'Abiertas', value: 'ABI' },
    { label: 'Confirmadas', value: 'CCR' },
    { label: 'Lista espera', value: 'WLT' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startDate'] || changes['endDate']) {
      this.loadReservations();
    }
  }

  get filteredReservations(): CalendarAssignableReservation[] {
    const assigned = new Set(this.assignedReservationIds);
    const search = this.normalize(this.search);
    const status = this.status.trim().toUpperCase();

    return this.reservations.filter((reservation) => {
      const matchesAssigned = !assigned.has(reservation.id);
      const matchesStatus = !status || this.normalizeStatus(reservation.status) === status;
      const matchesSearch =
        !search ||
        this.normalize(reservation.reservationCode).includes(search) ||
        this.normalize(reservation.agency).includes(search) ||
        this.normalize(reservation.guestName).includes(search);

      return matchesAssigned && matchesStatus && matchesSearch;
    });
  }

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }

  reload(): void {
    this.refresh.emit();
    this.loadReservations();
  }

  onReservationPointerDown(reservation: CalendarAssignableReservation, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dragStart.emit({ reservation, event });
  }

  selectReservation(reservation: CalendarAssignableReservation): void {
    this.reservationSelect.emit(reservation);
  }

  trackByReservation(_: number, reservation: CalendarAssignableReservation): string {
    return reservation.id;
  }

  statusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    const labels: Record<string, string> = {
      ABI: 'Abierta',
      CCR: 'Confirmada',
      WLT: 'Lista espera'
    };

    return labels[normalized] ?? (status || 'Pendiente');
  }

  loadReservations(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.isLoading = true;
    this.usingDemoData = false;

    this.calendarService
      .getPendingPrecheckingReservations(this.startDate, this.endDate)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las reservas pendientes de asignacion.', error);
          this.usingDemoData = true;
          return of(this.getDemoReservations());
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((reservations) => {
        this.reservations = reservations.length ? reservations : this.getDemoReservations();
        this.usingDemoData = !reservations.length;
      });
  }

  private getDemoReservations(): CalendarAssignableReservation[] {
    const start = this.startDate || this.toIsoDate(new Date());
    const secondStart = this.shiftIsoDate(start, 1);
    const thirdStart = this.shiftIsoDate(start, 2);

    return [
      {
        id: 'DEMO-2601|1',
        reservationCode: 'DEMO-2601',
        categoryCode: 'LOVE',
        sourceRoom: 'HB0001',
        startDate: start,
        endDate: this.shiftIsoDate(start, 2),
        nights: 2,
        rooms: 1,
        guestName: 'RIVAS CELIS / DAVID IVAN',
        agency: 'SWISS',
        status: 'CCR',
        operator: '',
        pax: 2,
        children: 0
      },
      {
        id: 'DEMO-2602|1',
        reservationCode: 'DEMO-2602',
        categoryCode: 'DELUX',
        sourceRoom: 'HB0001',
        startDate: secondStart,
        endDate: this.shiftIsoDate(secondStart, 3),
        nights: 3,
        rooms: 1,
        guestName: 'MAURICIO AVILA',
        agency: 'EXPEDIA',
        status: 'ABI',
        operator: '',
        pax: 4,
        children: 0
      },
      {
        id: 'DEMO-2603|1',
        reservationCode: 'DEMO-2603',
        categoryCode: 'SUITF',
        sourceRoom: 'HB0001',
        startDate: thirdStart,
        endDate: this.shiftIsoDate(thirdStart, 1),
        nights: 1,
        rooms: 1,
        guestName: 'SARA ISABEL MORENO',
        agency: 'DIRECTOS',
        status: 'WLT',
        operator: '',
        pax: 3,
        children: 1
      }
    ];
  }

  private normalizeStatus(status: string | null | undefined): string {
    return (status ?? '').trim().toUpperCase();
  }

  private normalize(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim().toLowerCase();
  }

  private shiftIsoDate(baseIsoDate: string, offset: number): string {
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

}
