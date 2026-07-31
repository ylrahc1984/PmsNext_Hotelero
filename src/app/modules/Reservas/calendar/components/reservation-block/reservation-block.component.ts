import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { differenceInPmsCalendarDays, normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  getRoomOperationalStateLabel,
  RoomOperationalVisualState
} from 'src/app/shared/models/room-operational-visual-state';
import { ReservaHabitacionDetalle } from '../../../interfaces/reserva-habitacion.interface';
import { ReservaHabitacionService } from '../../../services/reserva-habitacion.service';
import { CalendarReservationBlockSelect, CalendarReservationBlockView } from '../../interfaces/calendar.interface';

@Component({
  selector: 'app-reservation-block',
  standalone: true,
  imports: [CommonModule, NgbPopoverModule],
  templateUrl: './reservation-block.component.html',
  styleUrls: ['./reservation-block.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class ReservationBlockComponent implements OnDestroy {
  private readonly reservaService = inject(ReservaHabitacionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private detailRequest?: Subscription;
  private hovered = false;
  private focused = false;

  @Input({ required: true }) block!: CalendarReservationBlockView;
  @Input() isGhost = false;
  @Output() reservationSelect = new EventEmitter<CalendarReservationBlockSelect>();
  @Output() dragStart = new EventEmitter<{ block: CalendarReservationBlockView; event: PointerEvent }>();
  @ViewChild('reservationPopover') private reservationPopover?: NgbPopover;

  operationalDetail: ReservaHabitacionDetalle | null = null;
  detailLoading = false;
  detailUnavailable = false;

  ngOnDestroy(): void {
    this.detailRequest?.unsubscribe();
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  get stayNights(): number {
    const detailNights = Number(this.operationalDetail?.totNoches);
    if (Number.isFinite(detailNights) && detailNights > 0) {
      return detailNights;
    }

    return Math.max(differenceInPmsCalendarDays(this.block.reservation.startDate, this.block.reservation.endDate) ?? 1, 1);
  }

  get totalAdults(): number {
    return this.sumRoomDetailField('numPax');
  }

  get totalChildren(): number {
    return this.sumRoomDetailField('numChild');
  }

  get totalRooms(): number {
    const rooms = this.operationalDetail?.habitaciones ?? [];
    if (!rooms.length) {
      return 1;
    }

    return rooms.reduce((total, room) => total + Math.max(Number(room.cantHab) || 0, 0), 0) || rooms.length;
  }

  get reservationObservation(): string {
    return (this.operationalDetail?.observaciones || this.operationalDetail?.observacion || '').trim();
  }

  getVisualStateLabel(state: RoomOperationalVisualState): string {
    return getRoomOperationalStateLabel(state);
  }

  onPopoverMouseEnter(): void {
    this.hovered = true;
    this.loadOperationalDetail();
  }

  onPopoverMouseLeave(): void {
    this.hovered = false;
    this.resetDetailWhenInactive();
  }

  onPopoverFocus(): void {
    this.focused = true;
    this.loadOperationalDetail();
  }

  onPopoverBlur(): void {
    this.focused = false;
    this.resetDetailWhenInactive();
  }

  onSelect(event: MouseEvent): void {
    this.dismissPopoverForInteraction();

    if (this.block.reservation.isOperationalBlock) {
      return;
    }

    this.reservationSelect.emit({ block: this.block, event });
  }

  onDragStart(event: PointerEvent): void {
    if (event.button !== 0 || this.block.reservation.isOperationalBlock) {
      return;
    }

    this.dismissPopoverForInteraction();
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    this.dragStart.emit({ block: this.block, event });
  }

  private dismissPopoverForInteraction(): void {
    this.hovered = false;
    this.focused = false;
    this.reservationPopover?.close();
    this.resetDetailWhenInactive();
  }

  private loadOperationalDetail(): void {
    if (this.block.reservation.isOperationalBlock || !this.block.reservation.reservationCode || this.detailRequest) {
      return;
    }

    this.detailLoading = true;
    this.detailUnavailable = false;
    this.operationalDetail = null;
    this.cdr.markForCheck();

    const reservationCode = this.block.reservation.reservationCode;
    this.detailRequest = timer(220)
      .pipe(switchMap(() => this.reservaService.getReservaDetalle(reservationCode)))
      .subscribe({
        next: (detail) => {
          this.operationalDetail = detail;
          this.detailLoading = false;
          this.detailUnavailable = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.operationalDetail = null;
          this.detailLoading = false;
          this.detailUnavailable = true;
          this.cdr.markForCheck();
        }
      });
  }

  private resetDetailWhenInactive(): void {
    if (this.hovered || this.focused) {
      return;
    }

    this.detailRequest?.unsubscribe();
    this.detailRequest = undefined;
    this.operationalDetail = null;
    this.detailLoading = false;
    this.detailUnavailable = false;
    this.cdr.markForCheck();
  }

  private sumRoomDetailField(field: 'numPax' | 'numChild'): number {
    return (this.operationalDetail?.habitaciones ?? []).reduce((total, room) => total + Math.max(Number(room[field]) || 0, 0), 0);
  }
}
