import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AgenciaComision } from '../../interfaces/config-comision.interface';

@Component({
  selector: 'app-agencia-comision-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="agency-card">
      <div class="card-head">
        <div>
          <span class="code">{{ agencia.aD15_CodAgencia || 'N/D' }}</span>
          <h2>{{ nombreAgencia || 'Agencia ' + (agencia.aD15_CodAgencia || 'N/D') }}</h2>
        </div>
        <span class="state-badge" [class.inactive]="!agencia.aD15_Activo">{{ agencia.aD15_Activo ? 'ACTIVA' : 'INACTIVA' }}</span>
      </div>

      <div class="badge-row">
        <span class="type-badge" [class.fixed]="agencia.aD15_TipoComisionDefault === 'FIJO'">{{ agencia.aD15_TipoComisionDefault }}</span>
        <span class="commission-badge" [class.no]="!agencia.aD15_Comisiona">
          <i [class]="agencia.aD15_Comisiona ? 'feather icon-check' : 'feather icon-x'"></i>
          {{ agencia.aD15_Comisiona ? 'Comisiona' : 'No comisiona' }}
        </span>
      </div>

      <div class="value-box">
        <span>Valor comision</span>
        <strong>{{ formatValue() }}</strong>
      </div>

      <div class="validity">
        <span>Vigencia</span>
        <strong>{{ agencia.aD15_FechaInicio || 'Sin inicio' }} - {{ agencia.aD15_FechaFin || 'Sin fin' }}</strong>
      </div>

      <p>{{ agencia.aD15_Observaciones || 'Sin observaciones financieras.' }}</p>

      <footer>
        <button class="btn btn-outline-primary btn-sm" type="button" (click)="edit.emit(agencia)">
          <i class="feather icon-edit-2 me-1"></i>
          Editar
        </button>
        <button class="btn btn-sm" [class.btn-outline-danger]="agencia.aD15_Activo" [class.btn-outline-success]="!agencia.aD15_Activo" type="button" (click)="toggle.emit(agencia)">
          {{ agencia.aD15_Activo ? 'Desactivar' : 'Activar' }}
        </button>
      </footer>
    </article>
  `,
  styleUrl: './agencias-comision-card.component.scss'
})
export class AgenciasComisionCardComponent {
  @Input({ required: true }) agencia!: AgenciaComision;
  @Input() nombreAgencia = '';
  @Output() edit = new EventEmitter<AgenciaComision>();
  @Output() toggle = new EventEmitter<AgenciaComision>();

  formatValue(): string {
    const value = Number(this.agencia.aD15_ValorDefault ?? 0);
    if (this.agencia.aD15_TipoComisionDefault === 'FIJO') {
      return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(value);
    }
    return `${value.toFixed(2)}%`;
  }
}
