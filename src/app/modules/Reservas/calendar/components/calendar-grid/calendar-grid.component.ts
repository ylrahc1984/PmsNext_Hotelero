import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  CalendarAssignableReservation,
  CalendarAssignmentTarget,
  CalendarDate,
  CalendarReservation,
  CalendarReservationBlockSelect,
  CalendarReservationBlockView,
  CalendarReservationDropRequest,
  CalendarReservationStatus,
  CalendarRoomRowView
} from '../../interfaces/calendar.interface';
import { CalendarCellComponent } from '../calendar-cell/calendar-cell.component';
import { ReservationBlockComponent } from '../reservation-block/reservation-block.component';

interface CalendarGridDragState {
  reservationId: string;
  fromRoomNumber: string | null;
  span: number;
  label: string;
  status: CalendarReservationStatus;
  pointerOffsetX: number;
  block?: CalendarReservationBlockView;
  pendingReservation?: CalendarAssignableReservation;
}

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [CommonModule, CalendarCellComponent, ReservationBlockComponent],
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarGridComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) dates: CalendarDate[] = [];
  @Input({ required: true }) rows: CalendarRoomRowView[] = [];
  @Input() assignmentMode = false;
  @Input() assignmentSpan = 1;
  @Input() assignmentReservationId: string | null = null;

  @Output() scrollTopChange = new EventEmitter<number>();
  @Output() scrollLeftChange = new EventEmitter<number>();
  @Output() reservationSelect = new EventEmitter<CalendarReservationBlockSelect>();
  @Output() reservationDrop = new EventEmitter<CalendarReservationDropRequest>();
  @Output() reservationMoveBlocked = new EventEmitter<CalendarReservation>();
  @Output() assignmentTargetSelect = new EventEmitter<CalendarAssignmentTarget>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly cellWidth = 42;
  readonly rowHeight = 48;
  readonly timelineOffset = 0;

  dragState: CalendarGridDragState | null = null;

  dragPreview: {
    left: number;
    top: number;
    floatingLeft: number;
    floatingTop: number;
    width: number;
    label: string;
    roomNumber: string;
    targetDate: string;
    statusClass: string;
    valid: boolean;
  } | null = null;

  private dropCandidate: {
    roomNumber: string;
    categoryCode: string;
    targetDate: string;
    valid: boolean;
  } | null = null;

  private suppressScrollEvent = false;
  private isDragging = false;
  private hasDragMoved = false;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private wasDragCommitted = false;

  setScrollTop(value: number): void {
    if (!this.scrollContainer) {
      return;
    }

    this.suppressScrollEvent = true;
    this.scrollContainer.nativeElement.scrollTop = value;
  }

  resetScroll(): void {
    if (!this.scrollContainer) {
      return;
    }

    this.suppressScrollEvent = true;
    this.scrollContainer.nativeElement.scrollTop = 0;
    this.scrollContainer.nativeElement.scrollLeft = 0;
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;
    this.scrollLeftChange.emit(element.scrollLeft);

    if (this.suppressScrollEvent) {
      this.suppressScrollEvent = false;
      return;
    }

    this.scrollTopChange.emit(element.scrollTop);
  }

  onReservationDragStart(payload: { block: CalendarReservationBlockView; event: PointerEvent }): void {
    if (payload.block.reservation.reservationState?.trim().toUpperCase() === 'CHK') {
      this.reservationMoveBlocked.emit(payload.block.reservation);
      return;
    }

    this.beginDrag(
      {
        reservationId: payload.block.reservation.id,
        fromRoomNumber: payload.block.reservation.roomNumber,
        span: payload.block.span,
        label: payload.block.label,
        status: payload.block.reservation.status,
        pointerOffsetX: payload.event.offsetX,
        block: payload.block
      },
      payload.event
    );
  }

  startPendingReservationDrag(payload: { reservation: CalendarAssignableReservation; event: PointerEvent }): void {
    this.beginDrag(
      {
        reservationId: payload.reservation.id,
        fromRoomNumber: null,
        span: Math.max(payload.reservation.nights, 1),
        label: this.abbreviateName(payload.reservation.guestName),
        status: 'RESERVADA',
        pointerOffsetX: 16,
        pendingReservation: payload.reservation
      },
      payload.event
    );
  }

  isDraggedReservation(block: CalendarReservationBlockView): boolean {
    return this.dragState?.block?.reservation.id === block.reservation.id;
  }

  onReservationSelect(payload: CalendarReservationBlockSelect): void {
    if (this.wasDragCommitted) {
      this.wasDragCommitted = false;
      return;
    }

    this.reservationSelect.emit(payload);
  }

  trackByRoom(_: number, row: CalendarRoomRowView): string {
    return row.room.roomNumber;
  }

  trackByDate(_: number, date: CalendarDate): string {
    return date.isoDate;
  }

  trackByBlock(_: number, block: CalendarReservationBlockView): string {
    return block.reservation.id;
  }

  onAssignmentTargetSelect(row: CalendarRoomRowView, date: CalendarDate, dateIndex: number): void {
    if (!this.assignmentMode) {
      return;
    }

    const span = Math.max(this.assignmentSpan, 1);
    this.assignmentTargetSelect.emit({
      roomNumber: row.room.roomNumber,
      categoryCode: row.room.type,
      targetDate: date.isoDate,
      valid: this.isPlacementValid(row, dateIndex, span, this.assignmentReservationId ?? '')
    });
  }

  isAssignmentTargetValid(row: CalendarRoomRowView, dateIndex: number): boolean {
    return this.isPlacementValid(row, dateIndex, Math.max(this.assignmentSpan, 1), this.assignmentReservationId ?? '');
  }

  private beginDrag(state: CalendarGridDragState, event: PointerEvent): void {
    if (!this.scrollContainer || this.isDragging) {
      return;
    }

    this.isDragging = true;
    this.hasDragMoved = false;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.wasDragCommitted = false;
    this.dragState = state;

    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || !this.dragState) {
      return;
    }

    if (!this.hasDragMoved) {
      const distanceX = Math.abs(event.clientX - this.dragStartClientX);
      const distanceY = Math.abs(event.clientY - this.dragStartClientY);
      this.hasDragMoved = distanceX > 4 || distanceY > 4;
    }

    if (!this.hasDragMoved) {
      return;
    }

    this.updateDragPreview(event);
  };

  private handlePointerUp = (): void => {
    if (this.hasDragMoved && this.dragState && this.dropCandidate?.valid) {
      this.reservationDrop.emit({
        reservationId: this.dragState.reservationId,
        fromRoomNumber: this.dragState.fromRoomNumber,
        toRoomNumber: this.dropCandidate.roomNumber,
        toCategoryCode: this.dropCandidate.categoryCode,
        targetDate: this.dropCandidate.targetDate,
        pendingReservation: this.dragState.pendingReservation
      });
      this.wasDragCommitted = true;
    }

    this.clearDragState();
  };

  private updateDragPreview(event: PointerEvent): void {
    if (!this.dragState || !this.scrollContainer) {
      return;
    }

    const element = this.scrollContainer.nativeElement;
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left + element.scrollLeft - this.timelineOffset - this.dragState.pointerOffsetX;
    const y = event.clientY - rect.top + element.scrollTop;
    const floatingLeft = event.clientX - rect.left + element.scrollLeft - this.timelineOffset - this.dragState.pointerOffsetX;
    const floatingTop = event.clientY - rect.top + element.scrollTop - 18;

    const maxStartIndex = Math.max(0, this.dates.length - this.dragState.span);
    const startIndex = this.clamp(Math.round(x / this.cellWidth), 0, maxStartIndex);
    const rowIndex = this.clamp(Math.floor(y / this.rowHeight), 0, Math.max(0, this.rows.length - 1));
    const targetDate = this.dates[startIndex]?.isoDate;
    const targetRow = this.rows[rowIndex];

    if (!targetDate || !targetRow) {
      this.dragPreview = null;
      this.dropCandidate = null;
      this.cdr.detectChanges();
      return;
    }

    const valid = this.isPlacementValid(targetRow, startIndex, this.dragState.span, this.dragState.reservationId);

    this.dragPreview = {
      left: this.timelineOffset + startIndex * this.cellWidth + 2,
      top: rowIndex * this.rowHeight + 6,
      floatingLeft: this.timelineOffset + floatingLeft,
      floatingTop,
      width: Math.max(36, this.dragState.span * this.cellWidth - 4),
      label: this.dragState.label,
      roomNumber: targetRow.room.roomNumber,
      targetDate,
      statusClass: this.dragState.status.toLowerCase(),
      valid
    };

    this.dropCandidate = {
      roomNumber: targetRow.room.roomNumber,
      categoryCode: targetRow.room.type,
      targetDate,
      valid
    };

    this.cdr.detectChanges();
  }

  private isPlacementValid(row: CalendarRoomRowView, startIndex: number, span: number, reservationId: string): boolean {
    const endIndex = startIndex + span;

    return row.blocks
      .filter((block) => block.reservation.id !== reservationId)
      .every((block) => {
        const blockEnd = block.startIndex + block.span;
        return endIndex <= block.startIndex || startIndex >= blockEnd;
      });
  }

  private clearDragState(): void {
    this.isDragging = false;
    this.hasDragMoved = false;
    this.dragState = null;
    this.dragPreview = null;
    this.dropCandidate = null;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.cdr.detectChanges();
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private abbreviateName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0] || 'Reserva';
    }

    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }
}
