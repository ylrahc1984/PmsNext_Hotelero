import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-resumen-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="resumen-card">
      <div class="resumen-icon"><i [class]="icon"></i></div>
      <div>
        <span>{{ label }}</span>
        <strong>{{ value }}</strong>
        <small *ngIf="detail">{{ detail }}</small>
      </div>
    </article>
  `,
  styleUrl: './resumen-card.component.scss'
})
export class ResumenCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() detail = '';
  @Input() icon = 'feather icon-dollar-sign';
}
