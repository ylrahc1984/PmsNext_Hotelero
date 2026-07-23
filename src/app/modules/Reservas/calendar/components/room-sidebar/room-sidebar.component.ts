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
  @Input() viewportHeight: number | null = null;
  @Input() scrollContentHeight: number | null = null;
  @Output() scrollTopChange = new EventEmitter<number>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  setScrollTop(value: number): void {
    const element = this.scrollContainer?.nativeElement;
    if (!element) {
      return;
    }

    const nextScrollTop = Math.min(
      Math.max(Number(value) || 0, 0),
      Math.max(0, element.scrollHeight - element.clientHeight)
    );
    if (Math.abs(element.scrollTop - nextScrollTop) < 0.5) {
      return;
    }

    element.scrollTop = nextScrollTop;
  }

  resetScroll(): void {
    this.setScrollTop(0);
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;
    this.scrollTopChange.emit(element.scrollTop);
  }
}
