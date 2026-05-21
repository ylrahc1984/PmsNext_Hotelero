import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EstadoBadgeComponent } from './estado-badge.component';

export interface TablaFinancieraColumn {
  key: string;
  label: string;
  type?: 'text' | 'money' | 'percent' | 'estado';
}

@Component({
  selector: 'app-tabla-financiera',
  standalone: true,
  imports: [CommonModule, EstadoBadgeComponent],
  template: `
    <div class="table-responsive">
      <table class="finance-table">
        <thead>
          <tr>
            @for (column of columns; track column.key) {
              <th>{{ column.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row[idKey] || $index) {
            <tr>
              @for (column of columns; track column.key) {
                <td>
                  @if (column.type === 'estado') {
                    <app-estado-badge [estado]="text(row[column.key])" />
                  } @else if (column.type === 'money') {
                    <span class="money">{{ money(row[column.key]) }}</span>
                  } @else if (column.type === 'percent') {
                    <span>{{ number(row[column.key]) }}%</span>
                  } @else {
                    <span>{{ text(row[column.key]) }}</span>
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="columns.length">
                <div class="finance-empty">No hay registros para los filtros seleccionados.</div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './tabla-financiera.component.scss'
})
export class TablaFinancieraComponent {
  @Input() columns: TablaFinancieraColumn[] = [];
  @Input() rows: Record<string, unknown>[] = [];
  @Input() idKey = 'id';

  text(value: unknown): string {
    return value === null || value === undefined || value === '' ? 'N/D' : String(value);
  }

  number(value: unknown): string {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
  }

  money(value: unknown): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
  }
}
