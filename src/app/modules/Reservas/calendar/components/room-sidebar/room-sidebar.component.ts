import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarRoomRowView } from '../../interfaces/calendar.interface';

@Component({
  selector: 'app-room-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room-sidebar.component.html',
  styleUrls: ['./room-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomSidebarComponent {
  @Input({ required: true }) rows: CalendarRoomRowView[] = [];
  @Input() exchangeMode = false;
  @Input() exchangeTrayCount = 0;
  @Input() exchangeTrayHeight = 64;
  @Output() scrollTopChange = new EventEmitter<number>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  private suppressScrollEvent = false;

  setScrollTop(value: number): void {
    if (!this.scrollContainer) {
      return;
    }

    this.suppressScrollEvent = true;
    this.scrollContainer.nativeElement.scrollTop = value;
  }

  resetScroll(): void {
    this.setScrollTop(0);
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;
    if (this.suppressScrollEvent) {
      this.suppressScrollEvent = false;
      return;
    }

    this.scrollTopChange.emit(element.scrollTop);
  }
}
