import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-agencias-comision-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="agency-toolbar">
      <button class="btn btn-primary btn-sm" type="button" (click)="newConfig.emit()">
        <i class="feather icon-plus me-1"></i>
        Nueva Configuracion
      </button>

      <div class="search-field">
        <i class="feather icon-search"></i>
        <input
          class="form-control"
          [ngModel]="search"
          (ngModelChange)="searchChange.emit($event)"
          placeholder="Buscar agencia, codigo u observacion"
          autocomplete="off"
        />
      </div>

      <select class="form-select" [ngModel]="status" (ngModelChange)="statusChange.emit($event)">
        <option value="">Todas</option>
        <option value="ACTIVAS">Activas</option>
        <option value="INACTIVAS">Inactivas</option>
      </select>

      <button class="btn btn-outline-secondary btn-sm icon-btn" type="button" (click)="refresh.emit()" [disabled]="loading">
        <i class="feather icon-refresh-cw"></i>
      </button>
    </section>
  `,
  styleUrl: './agencias-comision-toolbar.component.scss'
})
export class AgenciasComisionToolbarComponent {
  @Input() search = '';
  @Input() status = '';
  @Input() loading = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() newConfig = new EventEmitter<void>();
}
