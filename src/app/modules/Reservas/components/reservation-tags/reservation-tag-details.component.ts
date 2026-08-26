import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

import { ReservaTagResumen } from '../../models/reserva-tag.model';
import { ReservationTagListComponent } from './reservation-tag-list.component';

@Component({
  selector: 'app-reservation-tag-details',
  standalone: true,
  imports: [CommonModule, ReservationTagListComponent],
  templateUrl: './reservation-tag-details.component.html',
  styleUrls: ['./reservation-tag-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationTagDetailsComponent {
  readonly reservationCode = input.required<string>();
  readonly tags = input<ReservaTagResumen[]>([]);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closed.emit();
  }
}
