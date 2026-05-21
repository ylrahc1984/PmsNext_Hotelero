import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-prioridad-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="prioridad-badge" [ngClass]="prioridadClass">P{{ display }}</span>`,
  styleUrl: './prioridad-badge.component.scss'
})
export class PrioridadBadgeComponent {
  @Input() prioridad: string | number | null | undefined = 'BAJA';

  get display(): string {
    return String(this.prioridad ?? 'BAJA').toUpperCase();
  }

  get prioridadClass(): string {
    const value = this.display;
    if (value === '1' || value.includes('ALTA')) return 'is-alta';
    if (value === '2' || value.includes('MEDIA')) return 'is-media';
    return 'is-baja';
  }
}
