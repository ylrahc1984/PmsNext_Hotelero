import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarDate, CalendarReservationBlockView, CalendarReservationDropRequest, CalendarRoomRowView } from '../../interfaces/calendar.interface';
import { CalendarCellComponent } from '../calendar-cell/calendar-cell.component';
import { ReservationBlockComponent } from '../reservation-block/reservation-block.component';

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [CommonModule, CalendarCellComponent, ReservationBlockComponent],
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarGridComponent {
  @Input({ required: true }) dates: CalendarDate[] = [];
  @Input({ required: true }) rows: CalendarRoomRowView[] = [];

  @Output() scrollTopChange = new EventEmitter<number>();
  @Output() scrollLeftChange = new EventEmitter<number>();
  @Output() reservationSelect = new EventEmitter<CalendarReservationBlockView>();
  @Output() reservationDrop = new EventEmitter<CalendarReservationDropRequest>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly cellWidth = 42;
  readonly rowHeight = 48;

  dragState: {
    block: CalendarReservationBlockView;
    pointerOffsetX: number;
  } | null = null;

  dragPreview: {
    left: number;
    top: number;
    width: number;
    label: string;
    statusClass: string;
    valid: boolean;
  } | null = null;

  private dropCandidate: {
    roomNumber: string;
    targetDate: string;
    valid: boolean;
  } | null = null;

  private suppressScrollEvent = false;
  private isDragging = false;
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
    if (!this.scrollContainer || this.isDragging) {
      return;
    }

    this.isDragging = true;
    this.wasDragCommitted = false;

    this.dragState = {
      block: payload.block,
      pointerOffsetX: payload.event.offsetX
    };

    this.updateDragPreview(payload.event);
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
  }

  isDraggedReservation(block: CalendarReservationBlockView): boolean {
    return this.dragState?.block.reservation.id === block.reservation.id;
  }

  onReservationSelect(block: CalendarReservationBlockView): void {
    if (this.wasDragCommitted) {
      this.wasDragCommitted = false;
      return;
    }

    this.reservationSelect.emit(block);
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

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || !this.dragState) {
      return;
    }

    this.updateDragPreview(event);
  };

  private handlePointerUp = (): void => {
    if (this.dragState && this.dropCandidate?.valid) {
      this.reservationDrop.emit({
        reservationId: this.dragState.block.reservation.id,
        fromRoomNumber: this.dragState.block.reservation.roomNumber,
        toRoomNumber: this.dropCandidate.roomNumber,
        targetDate: this.dropCandidate.targetDate
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
    const x = event.clientX - rect.left + element.scrollLeft - this.dragState.pointerOffsetX;
    const y = event.clientY - rect.top + element.scrollTop;

    const maxStartIndex = Math.max(0, this.dates.length - this.dragState.block.span);
    const startIndex = this.clamp(Math.round(x / this.cellWidth), 0, maxStartIndex);
    const rowIndex = this.clamp(Math.floor(y / this.rowHeight), 0, Math.max(0, this.rows.length - 1));
    const targetDate = this.dates[startIndex]?.isoDate;
    const targetRow = this.rows[rowIndex];

    if (!targetDate || !targetRow) {
      this.dragPreview = null;
      this.dropCandidate = null;
      return;
    }

    const valid = this.isPlacementValid(targetRow, startIndex, this.dragState.block.span, this.dragState.block.reservation.id);

    this.dragPreview = {
      left: startIndex * this.cellWidth + 2,
      top: rowIndex * this.rowHeight + 6,
      width: Math.max(36, this.dragState.block.span * this.cellWidth - 4),
      label: this.dragState.block.label,
      statusClass: this.dragState.block.reservation.status.toLowerCase(),
      valid
    };

    this.dropCandidate = {
      roomNumber: targetRow.room.roomNumber,
      targetDate,
      valid
    };
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
    this.dragState = null;
    this.dragPreview = null;
    this.dropCandidate = null;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
