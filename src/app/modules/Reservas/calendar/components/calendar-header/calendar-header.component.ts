import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarDate } from '../../interfaces/calendar.interface';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-header.component.html',
  styleUrls: ['./calendar-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarHeaderComponent {
  @Input({ required: true }) dates: CalendarDate[] = [];
  @Input({ required: true }) monthLabel = '';
  @Input() scrollLeft = 0;
}
