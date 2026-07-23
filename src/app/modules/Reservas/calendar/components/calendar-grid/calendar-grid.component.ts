import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  CalendarAssignableReservation,
  CalendarAssignmentTarget,
  CalendarDate,
  CalendarExchangeTrayAssignmentRequest,
  CalendarReservation,
  CalendarReservationBlockSelect,
  CalendarReservationBlockView,
  CalendarReservationDropRequest,
  CalendarReservationStatus,
  CalendarRoomRowView,
  ExchangeTrayReservation
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
  categoryCode: string;
  preserveDates: boolean;
  block?: CalendarReservationBlockView;
  trayItem?: ExchangeTrayReservation;
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
export class CalendarGridComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) dates: CalendarDate[] = [];
  @Input({ required: true }) rows: CalendarRoomRowView[] = [];
  @Input() assignmentMode = false;
  @Input() assignmentSpan = 1;
  @Input() assignmentReservationId: string | null = null;
  @Input() exchangeMode = false;
  @Input() exchangeTrayReservations: ExchangeTrayReservation[] = [];
  @Input() exchangeTrayHeight = 64;

  @Output() scrollTopChange = new EventEmitter<number>();
  @Output() scrollLeftChange = new EventEmitter<number>();
  @Output() viewportHeightChange = new EventEmitter<number>();
  @Output() scrollContentHeightChange = new EventEmitter<number>();
  @Output() reservationSelect = new EventEmitter<CalendarReservationBlockSelect>();
  @Output() reservationDrop = new EventEmitter<CalendarReservationDropRequest>();
  @Output() reservationMoveBlocked = new EventEmitter<CalendarReservation>();
  @Output() assignmentTargetSelect = new EventEmitter<CalendarAssignmentTarget>();
  @Output() reservationTrayDrop = new EventEmitter<string>();
  @Output() trayReservationDrop = new EventEmitter<CalendarExchangeTrayAssignmentRequest>();
  @Output() trayReservationSelect = new EventEmitter<string>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('scrollContent') private scrollContent?: ElementRef<HTMLDivElement>;

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
    warning: boolean;
    overExchangeTray: boolean;
  } | null = null;

  private dropCandidate: {
    roomNumber: string;
    categoryCode: string;
    targetDate: string;
    valid: boolean;
    overExchangeTray: boolean;
  } | null = null;

  private viewportResizeObserver?: ResizeObserver;
  private viewportMeasureFrame: number | null = null;
  private lastViewportHeight = -1;
  private lastScrollContentHeight = -1;
  private isDragging = false;
  private hasDragMoved = false;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private wasDragCommitted = false;

  ngAfterViewInit(): void {
    const element = this.scrollContainer?.nativeElement;
    if (!element) {
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.viewportResizeObserver = new ResizeObserver(() => this.scheduleViewportMeasurement());
      this.viewportResizeObserver.observe(element);
      if (this.scrollContent?.nativeElement) {
        this.viewportResizeObserver.observe(this.scrollContent.nativeElement);
      }
    }

    this.scheduleViewportMeasurement();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dates'] || changes['rows'] || changes['exchangeMode'] || changes['exchangeTrayHeight']) {
      this.scheduleViewportMeasurement();
    }
  }

  ngOnDestroy(): void {
    this.viewportResizeObserver?.disconnect();
    if (this.viewportMeasureFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.viewportMeasureFrame);
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  setScrollTop(value: number): void {
    const element = this.scrollContainer?.nativeElement;
    if (!element) {
      return;
    }

    const nextScrollTop = this.clamp(Number(value) || 0, 0, Math.max(0, element.scrollHeight - element.clientHeight));
    if (Math.abs(element.scrollTop - nextScrollTop) < 0.5) {
      return;
    }

    element.scrollTop = nextScrollTop;
  }

  getScrollTop(): number {
    return this.scrollContainer?.nativeElement.scrollTop ?? 0;
  }

  resetScroll(): void {
    if (!this.scrollContainer) {
      return;
    }

    this.scrollContainer.nativeElement.scrollTop = 0;
    this.scrollContainer.nativeElement.scrollLeft = 0;
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;
    this.scrollLeftChange.emit(element.scrollLeft);

    this.scrollTopChange.emit(element.scrollTop);
  }

  onReservationDragStart(payload: { block: CalendarReservationBlockView; event: PointerEvent }): void {
    if (payload.block.reservation.isOperationalBlock) {
      return;
    }

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
        categoryCode: payload.block.reservation.categoryCode || '',
        preserveDates: this.exchangeMode,
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
        categoryCode: payload.reservation.categoryCode,
        preserveDates: false,
        pendingReservation: payload.reservation
      },
      payload.event
    );
  }

  onTrayReservationDragStart(item: ExchangeTrayReservation, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    this.beginDrag(
      {
        reservationId: item.reservation.id,
        fromRoomNumber: null,
        span: item.block.span,
        label: item.block.label,
        status: item.reservation.status,
        pointerOffsetX: event.offsetX,
        categoryCode: item.reservation.categoryCode || '',
        preserveDates: true,
        block: item.block,
        trayItem: item
      },
      event
    );
  }

  onTrayReservationSelect(item: ExchangeTrayReservation, event: MouseEvent): void {
    if (this.wasDragCommitted) {
      this.wasDragCommitted = false;
      return;
    }
    event.stopPropagation();
    this.trayReservationSelect.emit(item.reservation.id);
  }

  isDraggedReservation(block: CalendarReservationBlockView): boolean {
    return this.dragState?.block?.reservation.id === block.reservation.id;
  }

  onReservationSelect(payload: CalendarReservationBlockSelect): void {
    if (payload.block.reservation.isOperationalBlock) {
      return;
    }

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

  trackByTrayReservation(_: number, item: ExchangeTrayReservation): string {
    return item.reservation.id;
  }

  get exchangeTrayContentHeight(): number {
    const laneCount = this.exchangeTrayReservations.length ? Math.max(...this.exchangeTrayReservations.map((item) => item.lane)) + 1 : 0;
    return Math.max(this.exchangeTrayHeight, laneCount * 42 + 16);
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
      if (this.dropCandidate.overExchangeTray && this.exchangeMode && !this.dragState.trayItem && !this.dragState.pendingReservation) {
        this.reservationTrayDrop.emit(this.dragState.reservationId);
        this.wasDragCommitted = true;
        this.clearDragState();
        return;
      }

      if (this.dragState.trayItem && !this.dropCandidate.overExchangeTray) {
        this.trayReservationDrop.emit({
          reservationId: this.dragState.reservationId,
          toRoomNumber: this.dropCandidate.roomNumber,
          toCategoryCode: this.dropCandidate.categoryCode
        });
        this.wasDragCommitted = true;
        this.clearDragState();
        return;
      }

      if (this.dropCandidate.overExchangeTray) {
        this.clearDragState();
        return;
      }

      this.reservationDrop.emit({
        reservationId: this.dragState.reservationId,
        fromRoomNumber: this.dragState.fromRoomNumber,
        toRoomNumber: this.dropCandidate.roomNumber,
        toCategoryCode: this.dropCandidate.categoryCode,
        targetDate: this.dragState.preserveDates && this.dragState.block ? this.dragState.block.reservation.startDate : this.dropCandidate.targetDate,
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
    const overExchangeTray = this.exchangeMode && event.clientY >= rect.top && event.clientY <= rect.top + this.exchangeTrayHeight;

    if (overExchangeTray) {
      const block = this.dragState.block;
      const trayLeft = block?.left ?? 2;
      const trayWidth = block?.width ?? Math.max(36, this.dragState.span * this.cellWidth - 4);
      const valid = !this.dragState.pendingReservation && !this.dragState.trayItem;
      this.dragPreview = {
        left: trayLeft,
        top: 8,
        floatingLeft: event.clientX - rect.left + element.scrollLeft - this.dragState.pointerOffsetX,
        floatingTop: element.scrollTop + 10,
        width: trayWidth,
        label: this.dragState.label,
        roomNumber: 'Bandeja de intercambio',
        targetDate: this.dragState.block?.reservation.startDate || '',
        statusClass: this.dragState.status.toLowerCase(),
        valid,
        warning: false,
        overExchangeTray: true
      };
      this.dropCandidate = {
        roomNumber: '',
        categoryCode: '',
        targetDate: this.dragState.block?.reservation.startDate || '',
        valid,
        overExchangeTray: true
      };
      this.cdr.detectChanges();
      return;
    }

    const x = event.clientX - rect.left + element.scrollLeft - this.timelineOffset - this.dragState.pointerOffsetX;
    const y = event.clientY - rect.top + element.scrollTop - (this.exchangeMode ? this.exchangeTrayHeight : 0);
    const floatingLeft = event.clientX - rect.left + element.scrollLeft - this.timelineOffset - this.dragState.pointerOffsetX;
    const floatingTop = event.clientY - rect.top + element.scrollTop - 18;

    const maxStartIndex = Math.max(0, this.dates.length - this.dragState.span);
    const preservedStartIndex = this.dragState.block?.startIndex ?? 0;
    const startIndex = this.dragState.preserveDates ? preservedStartIndex : this.clamp(Math.round(x / this.cellWidth), 0, maxStartIndex);
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
    const warning = valid && !!this.dragState.categoryCode && this.dragState.categoryCode.trim().toUpperCase() !== targetRow.room.type.trim().toUpperCase();
    const rowTop = (this.exchangeMode ? this.exchangeTrayHeight : 0) + rowIndex * this.rowHeight;

    this.dragPreview = {
      left: this.timelineOffset + startIndex * this.cellWidth + 2,
      top: rowTop + 6,
      floatingLeft: this.timelineOffset + floatingLeft,
      floatingTop,
      width: Math.max(36, this.dragState.span * this.cellWidth - 4),
      label: this.dragState.label,
      roomNumber: targetRow.room.roomNumber,
      targetDate,
      statusClass: this.dragState.status.toLowerCase(),
      valid,
      warning,
      overExchangeTray: false
    };

    this.dropCandidate = {
      roomNumber: targetRow.room.roomNumber,
      categoryCode: targetRow.room.type,
      targetDate,
      valid,
      overExchangeTray: false
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

  private scheduleViewportMeasurement(): void {
    if (!this.scrollContainer || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    if (this.viewportMeasureFrame !== null) {
      cancelAnimationFrame(this.viewportMeasureFrame);
    }

    this.viewportMeasureFrame = requestAnimationFrame(() => {
      this.viewportMeasureFrame = null;
      const height = this.scrollContainer?.nativeElement.clientHeight ?? 0;
      if (height > 0 && Math.abs(height - this.lastViewportHeight) >= 0.5) {
        this.lastViewportHeight = height;
        this.viewportHeightChange.emit(height);
      }

      const contentHeight = this.scrollContainer?.nativeElement.scrollHeight ?? 0;
      if (contentHeight > 0 && Math.abs(contentHeight - this.lastScrollContentHeight) >= 0.5) {
        this.lastScrollContentHeight = contentHeight;
        this.scrollContentHeightChange.emit(contentHeight);
      }
    });
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
