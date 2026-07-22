import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
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
  private loadSequence = 0;

  @Input({ required: true }) startDate!: string;
  @Input({ required: true }) endDate!: string;
  @Input() collapsed = false;
  @Input() selectedReservationId: string | null = null;

  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() reservationSelect = new EventEmitter<CalendarAssignableReservation>();
  @Output() dragStart = new EventEmitter<{ reservation: CalendarAssignableReservation; event: PointerEvent }>();
  @Output() refresh = new EventEmitter<void>();

  search = '';
  status = '';
  isLoading = false;
  errorMessage = '';
  showDateSettings = false;
  filterStartDate = '';
  filterEndDate = '';
  reservations: CalendarAssignableReservation[] = [];

  readonly statusOptions = [
    { label: 'Todas', value: '' },
    { label: 'Abiertas', value: 'ABI' },
    { label: 'Confirmadas', value: 'CCR' },
    { label: 'Lista espera', value: 'WLT' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startDate'] || changes['endDate']) {
      this.filterStartDate = this.startDate;
      this.filterEndDate = this.endDate;
      this.loadReservations();
    }
  }

  get filteredReservations(): CalendarAssignableReservation[] {
    const search = this.normalize(this.search);
    const status = this.status.trim().toUpperCase();

    return this.reservations.filter((reservation) => {
      const matchesStatus = !status || this.normalizeStatus(reservation.status) === status;
      const matchesSearch =
        !search ||
        this.normalize(reservation.reservationCode).includes(search) ||
        this.normalize(reservation.agency).includes(search) ||
        this.normalize(reservation.guestName).includes(search);

      return matchesStatus && matchesSearch;
    });
  }

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }

  reload(): void {
    this.loadReservations();
  }

  toggleDateSettings(): void {
    this.showDateSettings = !this.showDateSettings;
  }

  applyDateFilter(): void {
    if (!this.filterStartDate || !this.filterEndDate || this.filterStartDate > this.filterEndDate) {
      return;
    }

    this.showDateSettings = false;
    this.loadReservations();
  }

  isAssignable(reservation: CalendarAssignableReservation): boolean {
    return reservation.roomNumber.trim().toUpperCase().startsWith('HB');
  }

  onReservationPointerDown(reservation: CalendarAssignableReservation, event: PointerEvent): void {
    if (event.button !== 0 || !this.isAssignable(reservation)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dragStart.emit({ reservation, event });
  }

  selectReservation(reservation: CalendarAssignableReservation): void {
    if (!this.isAssignable(reservation)) {
      return;
    }
    this.reservationSelect.emit(reservation);
  }

  trackByReservation(_: number, reservation: CalendarAssignableReservation): string {
    return reservation.id;
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  loadReservations(): void {
    const queryStartDate = this.filterStartDate || this.startDate;
    const queryEndDate = this.filterEndDate || this.endDate;
    if (!queryStartDate || !queryEndDate || queryStartDate > queryEndDate) {
      return;
    }

    const loadId = ++this.loadSequence;
    this.isLoading = true;
    this.errorMessage = '';

    this.calendarService
      .getPendingPrecheckingReservations(queryStartDate, queryEndDate)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las reservas pendientes de asignacion.', error);
          this.errorMessage = 'No se pudieron cargar las reservas pendientes.';
          return of([] as CalendarAssignableReservation[]);
        }),
        finalize(() => {
          if (loadId === this.loadSequence) {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((reservations) => {
        if (loadId !== this.loadSequence) {
          return;
        }

        this.reservations = reservations;
        this.refresh.emit();
        this.cdr.markForCheck();
      });
  }

  private normalizeStatus(status: string | null | undefined): string {
    return (status ?? '').trim().toUpperCase();
  }

  private normalize(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim().toLowerCase();
  }

}
