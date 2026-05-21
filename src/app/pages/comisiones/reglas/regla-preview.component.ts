import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReglaComision } from '../interfaces/regla-comision.interface';

@Component({
  selector: 'app-regla-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <article class="preview-card">
      <div class="preview-head">
        <div>
          <span>Simulador de regla aplicada</span>
          <h2>Resolucion del motor</h2>
        </div>
        <button class="btn btn-outline-primary btn-sm" type="button" (click)="simulate.emit()">Simular</button>
      </div>

      <div class="preview-form">
        <input class="form-control" [ngModel]="codAgencia" (ngModelChange)="codAgenciaChange.emit($event)" placeholder="Codigo agencia" />
        <input class="form-control" [ngModel]="codServicio" (ngModelChange)="codServicioChange.emit($event)" placeholder="Codigo servicio" />
        <input class="form-control" type="date" [ngModel]="fecha" (ngModelChange)="fechaChange.emit($event)" />
      </div>

      @if (loading) {
        <div class="preview-result muted">Calculando regla vigente...</div>
      } @else if (regla) {
        <div class="preview-result">
          <span>Regla Aplicada</span>
          <strong>{{ regla.AD17_CodAgencia || 'GLOBAL' }} + {{ regla.AD17_CodServicio || 'GLOBAL' }}</strong>
          <div>
            <b>{{ formatValue(regla) }}</b>
            <em>Prioridad {{ regla.AD17_Prioridad }} · Tipo {{ regla.AD17_TipoComision }}</em>
          </div>
        </div>
      } @else {
        <div class="preview-result muted">Sin simulacion vigente para el contexto seleccionado.</div>
      }
    </article>
  `,
  styleUrl: './regla-preview.component.scss'
})
export class ReglaPreviewComponent {
  @Input() codAgencia = '';
  @Input() codServicio = '';
  @Input() fecha = '';
  @Input() regla: ReglaComision | null = null;
  @Input() loading = false;
  @Output() codAgenciaChange = new EventEmitter<string>();
  @Output() codServicioChange = new EventEmitter<string>();
  @Output() fechaChange = new EventEmitter<string>();
  @Output() simulate = new EventEmitter<void>();

  formatValue(regla: ReglaComision): string {
    const value = Number(regla.AD17_ValorComision ?? 0);
    return regla.AD17_TipoComision === 'FIJO' ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(value) : `${value}%`;
  }
}
