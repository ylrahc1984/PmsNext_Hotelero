import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface TimelineLiquidacionItem {
  label: string;
  date?: string;
  detail?: string;
  active?: boolean;
}

@Component({
  selector: 'app-timeline-liquidacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ol class="timeline">
      @for (item of items; track item.label) {
        <li [class.active]="item.active">
          <span></span>
          <div>
            <strong>{{ item.label }}</strong>
            <small>{{ item.date || 'Pendiente' }}</small>
            <p *ngIf="item.detail">{{ item.detail }}</p>
          </div>
        </li>
      }
    </ol>
  `,
  styleUrl: './timeline-liquidacion.component.scss'
})
export class TimelineLiquidacionComponent {
  @Input() items: TimelineLiquidacionItem[] = [];
}
