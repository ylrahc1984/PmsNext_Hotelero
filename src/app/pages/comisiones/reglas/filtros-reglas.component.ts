import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-filtros-reglas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rules-toolbar">
      <button class="btn btn-primary btn-sm" type="button" (click)="newRule.emit()">
        <i class="feather icon-plus me-1"></i>
        Nueva Regla
      </button>

      <div class="search-field">
        <i class="feather icon-search"></i>
        <input class="form-control" [ngModel]="search" (ngModelChange)="searchChange.emit($event)" placeholder="Buscar regla, agencia o servicio" />
      </div>

      <div class="agency-filter">
        <button class="btn btn-outline-secondary btn-sm agency-picker" type="button" (click)="openAgencyPicker.emit()">
          <i class="feather icon-briefcase"></i>
          <span>{{ agencyLabel || 'Seleccionar agencia' }}</span>
        </button>
        @if (agency) {
          <button class="btn btn-outline-secondary btn-sm icon-btn" type="button" (click)="clearAgency.emit()">
            <i class="feather icon-x"></i>
          </button>
        }
      </div>
      <input class="form-control" [ngModel]="service" (ngModelChange)="serviceChange.emit($event)" placeholder="Filtro servicio" />

      <select class="form-select" [ngModel]="status" (ngModelChange)="statusChange.emit($event)">
        <option value="">Todas</option>
        <option value="ACTIVAS">Activas</option>
        <option value="INACTIVAS">Inactivas</option>
      </select>

      <select class="form-select" [ngModel]="type" (ngModelChange)="typeChange.emit($event)">
        <option value="">Tipo</option>
        <option value="PORCENTAJE">Porcentaje</option>
        <option value="FIJO">Fijo</option>
      </select>

      <select class="form-select" [ngModel]="priority" (ngModelChange)="priorityChange.emit($event)">
        <option value="">Prioridad</option>
        <option value="ALTA">Alta</option>
        <option value="MEDIA">Media</option>
        <option value="BAJA">Baja</option>
      </select>

      <button class="btn btn-outline-secondary btn-sm icon-btn" type="button" (click)="refresh.emit()" [disabled]="loading">
        <i class="feather icon-refresh-cw"></i>
      </button>
    </section>
  `,
  styleUrl: './filtros-reglas.component.scss'
})
export class FiltrosReglasComponent {
  @Input() search = '';
  @Input() agency = '';
  @Input() agencyLabel = '';
  @Input() service = '';
  @Input() status = '';
  @Input() type = '';
  @Input() priority = '';
  @Input() loading = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() agencyChange = new EventEmitter<string>();
  @Output() openAgencyPicker = new EventEmitter<void>();
  @Output() clearAgency = new EventEmitter<void>();
  @Output() serviceChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() typeChange = new EventEmitter<string>();
  @Output() priorityChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() newRule = new EventEmitter<void>();
}
