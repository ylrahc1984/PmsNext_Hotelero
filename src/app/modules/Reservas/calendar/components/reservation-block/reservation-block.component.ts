import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  getRoomOperationalStateLabel,
  RoomOperationalVisualState
} from 'src/app/shared/models/room-operational-visual-state';
import { CalendarReservationBlockSelect, CalendarReservationBlockView } from '../../interfaces/calendar.interface';

@Component({
  selector: 'app-reservation-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-block.component.html',
  styleUrls: ['./reservation-block.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationBlockComponent {
  @Input({ required: true }) block!: CalendarReservationBlockView;
  @Input() isGhost = false;
  @Output() reservationSelect = new EventEmitter<CalendarReservationBlockSelect>();
  @Output() dragStart = new EventEmitter<{ block: CalendarReservationBlockView; event: PointerEvent }>();

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  getVisualStateLabel(state: RoomOperationalVisualState): string {
    return getRoomOperationalStateLabel(state);
  }

  onSelect(event: MouseEvent): void {
    if (this.block.reservation.isOperationalBlock) {
      return;
    }

    this.reservationSelect.emit({ block: this.block, event });
  }

  onDragStart(event: PointerEvent): void {
    if (event.button !== 0 || this.block.reservation.isOperationalBlock) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    this.dragStart.emit({ block: this.block, event });
  }
}
