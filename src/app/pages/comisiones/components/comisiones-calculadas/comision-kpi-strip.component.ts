import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ComisionKpiItem {
  label: string;
  value: string | number;
  detail?: string;
}

@Component({
  selector: 'app-comision-kpi-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="kpi-strip" aria-label="Resumen ejecutivo de comisiones">
      @for (item of items(); track item.label) {
        <div class="kpi-cell">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          @if (item.detail) {
            <small>{{ item.detail }}</small>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './comision-kpi-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComisionKpiStripComponent {
  readonly items = input<ComisionKpiItem[]>([]);
}
