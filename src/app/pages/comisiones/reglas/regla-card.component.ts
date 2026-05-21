import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReglaComision } from '../interfaces/regla-comision.interface';

@Component({
  selector: 'app-regla-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="rule-card" [class.global-rule]="isGlobal">
      <div class="rule-top">
        <div class="rule-badges">
          <span class="rule-type" [ngClass]="typeClass">{{ typeLabel }}</span>
          <span class="state-badge" [class.inactive]="!regla.AD17_Activo">{{ regla.AD17_Activo ? 'ACTIVA' : 'INACTIVA' }}</span>
        </div>
        <div class="rule-amount">
          <span>{{ regla.AD17_TipoComision || 'PORCENTAJE' }}</span>
          <strong>{{ formatValue() }}</strong>
        </div>
      </div>

      <div class="rule-context">
        <div class="context-item is-wide">
          <span class="eyebrow">Agencia</span>
          <h2>{{ agenciaLabel }}</h2>
        </div>
        <div class="context-item">
          <span class="eyebrow">Servicio</span>
          <p>{{ servicioLabel }}</p>
        </div>
        <div class="context-item">
          <span class="eyebrow">Tipo pax</span>
          <p>{{ tipoPaxLabel }}</p>
        </div>
      </div>

      <div class="rule-meta">
        <span class="priority-badge" [ngClass]="priorityClass">P{{ regla.AD17_Prioridad || 0 }}</span>
        <span class="date-range">{{ regla.AD17_FechaInicio || 'Sin inicio' }} - {{ regla.AD17_FechaFin || 'Sin cierre' }}</span>
      </div>

      <p class="observations">{{ regla.AD17_Observaciones || 'Sin observaciones financieras.' }}</p>

      <footer>
        <button class="btn btn-outline-primary btn-sm" type="button" (click)="edit.emit(regla)">
          <i class="feather icon-edit-2 me-1"></i>
          Editar
        </button>
        <button
          class="btn btn-sm"
          [class.btn-outline-danger]="regla.AD17_Activo"
          [class.btn-outline-success]="!regla.AD17_Activo"
          type="button"
          (click)="toggle.emit(regla)"
        >
          {{ regla.AD17_Activo ? 'Desactivar' : 'Activar' }}
        </button>
      </footer>
    </article>
  `,
  styleUrl: './regla-card.component.scss'
})
export class ReglaCardComponent {
  @Input({ required: true }) regla!: ReglaComision;
  @Input() agenciaNombre = '';
  @Input() servicioNombre = '';
  @Output() edit = new EventEmitter<ReglaComision>();
  @Output() toggle = new EventEmitter<ReglaComision>();

  get isGlobal(): boolean {
    return !this.regla.AD17_CodAgencia && !this.regla.AD17_CodServicio && !this.regla.AD17_TipPax;
  }

  get agenciaLabel(): string {
    return this.regla.AD17_CodAgencia ? `${this.regla.AD17_CodAgencia}${this.agenciaNombre ? ' - ' + this.agenciaNombre : ''}` : 'Todas las agencias';
  }

  get servicioLabel(): string {
    return this.regla.AD17_CodServicio ? `${this.regla.AD17_CodServicio}${this.servicioNombre ? ' - ' + this.servicioNombre : ''}` : 'Todos los servicios';
  }

  get tipoPaxLabel(): string {
    return this.regla.AD17_TipPax || 'Todos los tipos pax';
  }

  get typeLabel(): string {
    if (this.isGlobal) return 'Regla Global';
    if (this.regla.AD17_CodAgencia && this.regla.AD17_CodServicio && this.regla.AD17_TipPax) return 'Regla Especifica';
    if (this.regla.AD17_CodAgencia) return 'Agencia';
    if (this.regla.AD17_TipPax) return 'Tipo Pax';
    return 'Servicio';
  }

  get typeClass(): string {
    if (this.isGlobal) return 'is-global';
    if (this.regla.AD17_CodAgencia && this.regla.AD17_CodServicio && this.regla.AD17_TipPax) return 'is-specific';
    if (this.regla.AD17_CodAgencia) return 'is-agency';
    return 'is-service';
  }

  get priorityClass(): string {
    const priority = Number(this.regla.AD17_Prioridad ?? 0);
    if (priority >= 8) return 'is-high';
    if (priority >= 4) return 'is-medium';
    return 'is-low';
  }

  formatValue(): string {
    const value = Number(this.regla.AD17_ValorComision ?? 0);
    if ((this.regla.AD17_TipoComision || '').toUpperCase() === 'FIJO') {
      return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(value);
    }
    return `${value.toFixed(2)}%`;
  }
}
