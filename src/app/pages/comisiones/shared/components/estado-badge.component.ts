import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-estado-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="estado-badge" [ngClass]="estadoClass">{{ label }}</span>`,
  styleUrl: './estado-badge.component.scss'
})
export class EstadoBadgeComponent {
  @Input() estado: string | null | undefined = 'BORRADOR';

  get label(): string {
    return String(this.estado || 'BORRADOR').toUpperCase();
  }

  get estadoClass(): string {
    const value = this.label;
    if (value.includes('PENDIENTE')) return 'is-pendiente';
    if (value.includes('LIQUIDADO')) return 'is-liquidado';
    if (value.includes('PAGADO')) return 'is-pagado';
    if (value.includes('ANULADO')) return 'is-anulado';
    if (value.includes('CERRADO')) return 'is-cerrado';
    return 'is-borrador';
  }
}
