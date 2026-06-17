import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-cell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-cell.component.html',
  styleUrls: ['./calendar-cell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarCellComponent {
  @Input() isToday = false;
  @Input() isWeekend = false;
}
