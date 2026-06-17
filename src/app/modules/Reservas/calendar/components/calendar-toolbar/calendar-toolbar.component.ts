import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RoomType } from '../../../interfaces/room-status.interface';
import { CalendarFilterStatus } from '../../interfaces/calendar.interface';

@Component({
  selector: 'app-calendar-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-toolbar.component.html',
  styleUrls: ['./calendar-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarToolbarComponent {
  @Input({ required: true }) startDate!: string;
  @Input({ required: true }) endDate!: string;
  @Input({ required: true }) search!: string;
  @Input() type: RoomType | null = null;
  @Input() status: CalendarFilterStatus = null;
  @Input({ required: true }) typeOptions!: RoomType[];
  @Input({ required: true }) statusOptions!: Array<{ label: string; value: CalendarFilterStatus }>;
  @Input({ required: true }) visibleRooms = 0;
  @Input({ required: true }) visibleReservations = 0;

  @Output() startDateChange = new EventEmitter<string>();
  @Output() endDateChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() typeChange = new EventEmitter<RoomType | null>();
  @Output() statusChange = new EventEmitter<CalendarFilterStatus>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();

  onTypeModelChange(value: string): void {
    this.typeChange.emit((value || null) as RoomType | null);
  }

  onStatusModelChange(value: string): void {
    this.statusChange.emit((value || null) as CalendarFilterStatus);
  }
}
