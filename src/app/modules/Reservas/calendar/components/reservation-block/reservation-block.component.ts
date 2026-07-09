import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  @Output() select = new EventEmitter<CalendarReservationBlockSelect>();
  @Output() dragStart = new EventEmitter<{ block: CalendarReservationBlockView; event: PointerEvent }>();

  onSelect(event: MouseEvent): void {
    this.select.emit({ block: this.block, event });
  }

  onDragStart(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
    this.dragStart.emit({ block: this.block, event });
  }
}
