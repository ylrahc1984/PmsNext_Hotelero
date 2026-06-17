import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarReservationBlockView } from '../../interfaces/calendar.interface';

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
  @Output() select = new EventEmitter<CalendarReservationBlockView>();
  @Output() dragStart = new EventEmitter<{ block: CalendarReservationBlockView; event: PointerEvent }>();

  onSelect(): void {
    this.select.emit(this.block);
  }

  onDragStart(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.dragStart.emit({ block: this.block, event });
  }
}
